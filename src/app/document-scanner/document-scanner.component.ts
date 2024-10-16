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
      this.stream.getTracks().forEach((track) => track.stop());
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
  processImage() {
    const startTime = performance.now();

    const canvas = this.canvas.nativeElement;
    const img = cv.imread(canvas);

    // Make sure to use the image before any deletion
    const colorImg = new cv.Mat();
    cv.cvtColor(img, colorImg, cv.COLOR_RGBA2BGR);

    const grayImg = new cv.Mat();
    cv.cvtColor(img, grayImg, cv.COLOR_RGBA2GRAY);

    // Apply Canny edge detection
    cv.Canny(grayImg, grayImg, this.threshold1, this.threshold2, 3, false);

    // Find contours
    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();
    cv.findContours(
      grayImg,
      contours,
      hierarchy,
      cv.RETR_CCOMP,
      cv.CHAIN_APPROX_SIMPLE
    );

    // If no biggest contour, find the bounding rectangle of the largest contour
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

      // Draw bounding rectangle on the color image
      const boundingColor = new cv.Scalar(0, 255, 0); // Green
      cv.rectangle(
        colorImg,
        new cv.Point(rect.x, rect.y),
        new cv.Point(rect.x + rect.width, rect.y + rect.height),
        boundingColor,
        2
      );

      // Draw corner circles
      const cornerColor = new cv.Scalar(0, 0, 255); // Red
      const corners = [
        new cv.Point(rect.x, rect.y),
        new cv.Point(rect.x + rect.width, rect.y),
        new cv.Point(rect.x, rect.y + rect.height),
        new cv.Point(rect.x + rect.width, rect.y + rect.height),
      ];
      corners.forEach((corner) => {
        cv.circle(colorImg, corner, 5, cornerColor, -1); // Red points
      });
    } else {
      console.log('No contours found, unable to process image');
    }

    const endTime = performance.now();
    this.processingTime = `Processing Time: ${(endTime - startTime).toFixed(
      2
    )} ms`;

    // Convert Mat to data URL (the original image with contours and bounding box)
    this.contourImage = this.convertMatToImage(colorImg);

    // Clean up memory
    img.delete();
    grayImg.delete();
    colorImg.delete();
    contours.delete();
    hierarchy.delete();
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
