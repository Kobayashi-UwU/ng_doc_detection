import { Component, ElementRef, ViewChild } from '@angular/core';
declare var cv: any;

@Component({
  selector: 'app-document-scanner',
  templateUrl: './document-scanner.component.html',
  styleUrls: ['./document-scanner.component.css'],
})
export class DocumentScannerComponent {
  @ViewChild('video', { static: false }) video!: ElementRef;
  @ViewChild('canvas', { static: false }) canvas!: ElementRef;

  selectedCameraId: string = '';
  stream!: MediaStream; // Or initialize as null: stream: MediaStream | null = null;
  processingTime: string = '';
  contourImage: string = '';
  outputImage: string = '';
  imageInfo: string = '';

  cameras: MediaDeviceInfo[] = [];
  cameraActive = false;
  threshold1 = 150;
  threshold2 = 50;

  constructor() {}

  ngOnInit() {
    this.getCameras();
  }

  // Get available cameras
  async getCameras() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    this.cameras = devices.filter((device) => device.kind === 'videoinput');
  }

  // Start the selected camera
  async startCamera() {
    if (this.stream) {
      this.stopCamera();
    }

    const constraints = {
      video: {
        deviceId: this.selectedCameraId
          ? { exact: this.selectedCameraId }
          : undefined,
        width: { ideal: 1920 }, // Desired width
        height: { ideal: 1080 }, // Desired height
      },
    };

    try {
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.video.nativeElement.srcObject = this.stream;
      this.cameraActive = true;
    } catch (err) {
      console.error('Error accessing camera:', err);
    }
  }

  // Stop the camera
  stopCamera() {
    if (this.stream) {
      // Stop all media tracks in the stream
      this.stream.getTracks().forEach((track) => track.stop());

      // Clear the stream and the video source
      this.video.nativeElement.srcObject = null; // Remove video stream
      this.stream = null as any;
      this.cameraActive = false;
    }
  }

  // Capture a photo from the video feed
  takePhoto() {
    const canvas = this.canvas.nativeElement;
    const video = this.video.nativeElement;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const context = canvas.getContext('2d');
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.style.display = 'block';
  }

  // Process image
  // Process image
  processImage() {
    const startTime = performance.now();

    const canvas = this.canvas.nativeElement;
    const img = cv.imread(canvas);
    const originalImage = img.clone(); // Clone the original image
    const original_width = originalImage.cols; // cols for width in OpenCV
    const original_height = originalImage.rows; // rows for height in OpenCV

    // log information
    console.log('Image Width:', original_width);
    console.log('Image Height:', original_height);
    console.log('Resolution:', `${original_width} x ${original_height}`);

    // Display the information in the UI
    this.imageInfo = `Width: ${original_width}, Height: ${original_height}, Resolution: ${original_width} x ${original_height}`;

    // Resize the image
    const resized_height = 240;
    const resized_width = 180;
    const resizedImg = new cv.Mat();
    cv.resize(img, resizedImg, new cv.Size(resized_width, resized_height));

    // Calculate scale factors for width and height
    const widthScale = original_width / resized_width;
    const heightScale = original_height / resized_height;

    // Convert to grayscale
    const grayImg = new cv.Mat();
    cv.cvtColor(resizedImg, grayImg, cv.COLOR_RGBA2GRAY);

    // Apply Gaussian blur
    const blurredImg = new cv.Mat();
    cv.GaussianBlur(grayImg, blurredImg, new cv.Size(5, 5), 1);

    // Apply Canny edge detection
    cv.Canny(
      blurredImg,
      blurredImg,
      this.threshold1,
      this.threshold2,
      3,
      false
    );

    // Find contours
    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();
    cv.findContours(
      blurredImg,
      contours,
      hierarchy,
      cv.RETR_CCOMP,
      cv.CHAIN_APPROX_SIMPLE
    );

    // Find the bounding rectangle of the largest contour
    let largestContour = null;
    let maxArea = 0;
    for (let i = 0; i < contours.size(); i++) {
      const contour = contours.get(i);
      const area = cv.contourArea(contour);
      if (area > maxArea) {
        maxArea = area;
        largestContour = contour;
      }
    }

    if (largestContour) {
      // Find the bounding rectangle of the largest contour
      const rect = cv.boundingRect(largestContour);

      // Scale the rectangle back to original image size
      const originalRect = {
        x: Math.round(rect.x * widthScale),
        y: Math.round(rect.y * heightScale),
        width: Math.round(rect.width * widthScale),
        height: Math.round(rect.height * heightScale),
      };

      // Draw bounding rectangle on the original image
      const boundingColor = new cv.Scalar(0, 255, 0); // Green
      cv.rectangle(
        originalImage,
        new cv.Point(originalRect.x, originalRect.y),
        new cv.Point(
          originalRect.x + originalRect.width,
          originalRect.y + originalRect.height
        ),
        boundingColor,
        2
      );

      // Draw corner circles
      const cornerColor = new cv.Scalar(0, 0, 255); // Red
      const corners = [
        new cv.Point(originalRect.x, originalRect.y),
        new cv.Point(originalRect.x + originalRect.width, originalRect.y),
        new cv.Point(originalRect.x, originalRect.y + originalRect.height),
        new cv.Point(
          originalRect.x + originalRect.width,
          originalRect.y + originalRect.height
        ),
      ];
      corners.forEach((corner) => {
        cv.circle(originalImage, corner, 5, cornerColor, -1); // Red points
      });
    } else {
      console.log('No contours found, unable to process image');
    }

    const endTime = performance.now();
    this.processingTime = `Processing Time: ${(endTime - startTime).toFixed(
      2
    )} ms`;

    // Convert Mat to data URL (the original image with contours and bounding box)
    this.contourImage = this.convertMatToImage(originalImage);

    // Clean up memory
    img.delete();
    grayImg.delete();
    resizedImg.delete();
    blurredImg.delete();
    contours.delete();
    hierarchy.delete();
    originalImage.delete();
  }

  convertMatToImage(mat: any): string {
    const canvas = document.createElement('canvas');
    cv.imshow(canvas, mat);
    return canvas.toDataURL();
  }

  // Download the processed image
  downloadPhoto() {
    const a = document.createElement('a');
    a.href = this.contourImage;
    a.download = 'scanned_document.png';
    a.click();
  }

  // Handle file input for image uploads
  onFileSelected(event: any) {
    const file = event.target.files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      const imgElement = document.createElement('img');
      imgElement.src = e.target?.result as string;

      imgElement.onload = () => {
        const canvas = this.canvas.nativeElement;
        const context = canvas.getContext('2d');
        canvas.width = imgElement.width;
        canvas.height = imgElement.height;
        context.drawImage(
          imgElement,
          0,
          0,
          imgElement.width,
          imgElement.height
        );
      };
    };
    reader.readAsDataURL(file);
  }
}
