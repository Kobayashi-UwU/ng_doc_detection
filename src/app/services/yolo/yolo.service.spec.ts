import { YoloService } from './yolo.service';
import { TestBed } from '@angular/core/testing';

describe('YoloService', () => {
  let service: YoloService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(YoloService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
