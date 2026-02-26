import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Timings } from '../models/timings';

@Injectable({
  providedIn: 'root'
})
export class PrayerService {
  private http = inject(HttpClient);
  private backendUrl = 'http://localhost:8080/api';

  getTodayTimings(city: string = 'Toronto', country: string = 'Canada'): Observable<Timings> {
    return this.http.get<Timings>(`${this.backendUrl}/today`, {
      params: { city, country }
    });
  }

  getRamadanDay(city: string = 'Toronto', country: string = 'Canada'): Observable<string> {
    return this.http.get(`${this.backendUrl}/ramadan/day`, {
      params: { city, country },
      responseType: 'text' as 'json'
    }) as Observable<string>;
  }
}
