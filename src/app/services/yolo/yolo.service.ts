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
    'bank_acc',
    'card_id',
    'copy_bank_acc',
    'copy_card_id',
    'copy_driving_license',
    'copy_passport',
    'driving_license',
    'glasses',
    'hat',
    'mask',
    'passport',
    'sunglasses',
  ];

  yoloprocessingTime: string = '';

  constructor() {}

  // Wait for TensorFlow to be ready before loading the model
  async loadModel() {
    // Ensure TensorFlow is ready and backend is set to WASM
    await tf.ready();

    // Load the YOLOv5 model
    this.model.net = await tf.loadGraphModel('model.json', {
      onProgress: (fraction) => {
        console.log(`Model loading progress: ${(fraction * 100).toFixed(2)}%`);
      },
    });

    // Warm up the model with a dummy input
    const dummyInput = tf.ones([1, 224, 224, 3]);
    await this.model.net.executeAsync(dummyInput);
    tf.dispose(dummyInput);

    console.log('YOLO model loaded successfully');
  }

  // Process the image using the loaded YOLOv5 model
  async processYolo(img: any): Promise<string> {
    const inputSize = 224;
    let resizedYOLOImg = new cv.Mat();

    try {
      // Resize image to the input size expected by YOLOv5
      cv.resize(img, resizedYOLOImg, new cv.Size(inputSize, inputSize));

      // Apply Gaussian blur
      const blurredImg = new cv.Mat();
      cv.GaussianBlur(resizedYOLOImg, blurredImg, new cv.Size(3, 3), 3);
      resizedYOLOImg.delete(); // Clean up previous Mat
      resizedYOLOImg = blurredImg;

      // Convert OpenCV Mat to ImageData
      const canvas = document.createElement('canvas');
      canvas.width = resizedYOLOImg.cols;
      canvas.height = resizedYOLOImg.rows;
      cv.imshow(canvas, resizedYOLOImg);

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        console.error('Failed to get canvas 2D context');
        return '';
      }

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      // Convert image data to Tensor
      const inputTensor = tf.browser
        .fromPixels(imageData)
        .expandDims(0)
        .div(255.0);
      const predictions = await this.model.net.executeAsync(inputTensor);

      // Process predictions
      const result = this.processPredictions(
        predictions,
        resizedYOLOImg,
        inputSize
      );

      tf.dispose([inputTensor, ...predictions]); // Clean up tensors
      return result;
    } catch (err) {
      console.error('Error in YOLO inference:', err);
      return '';
    } finally {
      resizedYOLOImg.delete(); // Clean up OpenCV Mat
    }
  }

  // Process the YOLOv5 predictions
  private processPredictions(
    predictions: tf.Tensor[],
    resizedYOLOImg: any,
    inputSize: number
  ): string {
    const [boxesTensor, scoresTensor, classesTensor] = predictions;
    const boxes = boxesTensor.arraySync() as number[][][];
    const scores = scoresTensor.arraySync() as number[][];
    const classes = classesTensor.arraySync() as number[][];

    let detectionCount = 0;
    const threshold = 0.01;

    for (let i = 0; i < boxes[0].length; i++) {
      if (scores[0][i] > threshold) {
        detectionCount++;
        const [ymin, xmin, ymax, xmax] = boxes[0][i];
        const y1 = Math.round(xmin * inputSize);
        const x1 = Math.round(ymin * inputSize);
        const y2 = Math.round(xmax * inputSize);
        const x2 = Math.round(ymax * inputSize);

        const boundingColor = new cv.Scalar(0, 255, 0);
        cv.rectangle(
          resizedYOLOImg,
          new cv.Point(x1, y1),
          new cv.Point(x2, y2),
          boundingColor,
          2
        );

        const classIndex = classes[0][i];
        const className = this.classNames[classIndex];
        console.log('Found Object : ' + className);
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
    return this.convertMatToImage(resizedYOLOImg); // Convert image to base64 string
  }

  // Convert OpenCV Mat to base64 image
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

    canvas.remove();
    return imageData;
  }
}
