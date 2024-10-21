import { TestBed } from '@angular/core/testing';

import { YoloService } from './yolo.service';

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
