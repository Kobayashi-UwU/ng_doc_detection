import { Injectable } from '@angular/core';
import * as tf from '@tensorflow/tfjs';
declare var cv: any;

@Injectable({
  providedIn: 'root',
})
export class YoloService {
  model: any = {
    net: null,
    inputShape: [1, 224, 224, 3],
  };

  classNames: string[] = [
    'card_id',
    'driving_license',
    'glasses',
    'hat',
    'mask',
    'passport',
    'sunglasses',
  ];
  yoloprocessingTime: string = '';

  constructor() {}

  async loadModel() {
    await tf.ready();

    // Load YOLOv5 model
    this.model.net = await tf.loadGraphModel('model.json', {
      onProgress: (fraction) => {
        console.log(`Model loading progress: ${(fraction * 100).toFixed(2)}%`);
      },
    });

    // Warm up the model
    const dummyInput = tf.ones([1, 224, 224, 3]);
    await this.model.net.executeAsync(dummyInput);
    tf.dispose(dummyInput);

    console.log('YOLO model loaded successfully');
  }

  async processYolo(img: any): Promise<string> {
    const inputSize = 224;
    let resizedYOLOImg = new cv.Mat();

    // Resize image for YOLO input size
    cv.resize(img, resizedYOLOImg, new cv.Size(inputSize, inputSize));

    // Convert to grayscale
    const grayImg = new cv.Mat();
    cv.cvtColor(resizedYOLOImg, grayImg, cv.COLOR_RGBA2GRAY);

    // Apply Gaussian blur
    const blurredImg = new cv.Mat();
    cv.GaussianBlur(grayImg, blurredImg, new cv.Size(3, 3), 3);

    resizedYOLOImg = blurredImg;

    // Create a canvas to extract the image data
    const canvas = document.createElement('canvas');
    canvas.width = resizedYOLOImg.cols;
    canvas.height = resizedYOLOImg.rows;
    cv.imshow(canvas, resizedYOLOImg);

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error('Failed to get canvas 2D context');
      resizedYOLOImg.delete();
      return '';
    }

    // Get image data from canvas for YOLO input
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Convert image to TensorFlow tensor for YOLO input
    const inputTensor = tf.tidy(() => {
      return tf.browser.fromPixels(imageData).expandDims(0).div(255.0);
    });

    try {
      const predictions = await this.model.net.executeAsync(inputTensor);

      // Log predictions for debugging
      console.log('Raw predictions:', predictions);

      const boxes = await predictions[0].array();
      const scores = await predictions[1].array();
      const classes = await predictions[2].array();

      console.log('Boxes:', boxes);
      console.log('Scores:', scores);
      console.log('Classes:', classes);

      let detectionCount = 0;
      let threshold = 0.01;
      for (let i = 0; i < boxes[0].length; i++) {
        if (scores[0][i] > threshold) {
          detectionCount++;
          const [ymin, xmin, ymax, xmax] = boxes[0][i];

          // Use coordinates directly from YOLO output, since they're relative to the resized image
          const y1 = Math.round(xmin * inputSize);
          const x1 = Math.round(ymin * inputSize);
          const y2 = Math.round(xmax * inputSize);
          const x2 = Math.round(ymax * inputSize);

          // Draw bounding box for YOLO detections
          const boundingColor = new cv.Scalar(0, 255, 0);
          cv.rectangle(
            resizedYOLOImg, // Draw on the resized image
            new cv.Point(x1, y1),
            new cv.Point(x2, y2),
            boundingColor,
            2
          );

          const classIndex = classes[0][i];
          const className = this.classNames[classIndex];
          const label = `${className}: ${scores[0][i].toFixed(2)}`;
          cv.putText(
            resizedYOLOImg,
            label,
            new cv.Point(x1, y1 - 10),
            cv.FONT_HERSHEY_SIMPLEX,
            0.5,
            boundingColor,
            2
          );
        }
      }

      console.log(`Number of detections: ${detectionCount}`);

      // Convert the processed resized image to a data URL
      return this.convertMatToImage(resizedYOLOImg); // Return the resized image with boxes
    } catch (err) {
      console.error('Error in YOLO inference:', err);
      return '';
    } finally {
      resizedYOLOImg.delete();
      tf.dispose(inputTensor);
      // tf.dispose(predictions);
    }
  }

  private convertMatToImage(mat: any): string {
    if (!mat || mat.isDeleted()) {
      console.error(
        'Mat object has been deleted or is null, cannot convert to image'
      );
      return '';
    }

    const canvas = document.createElement('canvas');
    cv.imshow(canvas, mat);
    const imageData = canvas.toDataURL();

    // Clean up the temporary canvas
    canvas.remove();

    return imageData;
  }
}
