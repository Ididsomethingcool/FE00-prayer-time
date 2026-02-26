import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { interval, Subscription } from 'rxjs';
import { PrayerService } from './services/prayer';
import { Timings } from './models/timings';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, OnDestroy {
  private prayerService = inject(PrayerService);
  private cdr = inject(ChangeDetectorRef);
  private timerId?: number;

  currentTime = new Date();
  tickCount = 0;
  fajrTime?: Date;
  dhuhrTime?: Date;
  asrTime?: Date;
  maghribTime?: Date;
  ishaTime?: Date;
  timings?: Timings;
  ramadanDay?: string;
  ramadanLoading = true;
  currentPrayer = '—';
  isFasting = false;
  clockSubscription?: Subscription;
  loading = true;

  ngOnInit(): void {
    this.prayerService.getTodayTimings().subscribe({
      next: (data) => {
        console.log('Prayer timings received:', data);
        this.timings = data;
        try {
          this.updatePrayerTimesFromTimings(data);
        } catch (err) {
          console.error('Error parsing prayer times:', err, data);
        } finally {
          this.loading = false;
        }
        this.updatePrayerState();
      },
      error: (err) => {
        console.error('Prayer API error:', err);
        this.loading = false;
      }
    });

    // fetch Ramadan day text
    this.prayerService.getRamadanDay().subscribe({
      next: (d) => {
        console.log('Ramadan day received:', d);
        this.ramadanDay = d;
        this.ramadanLoading = false;
      },
      error: (err) => {
        console.error('Ramadan day error:', err);
        this.ramadanLoading = false;
      }
    });

    // Use native setInterval to guarantee a browser timer regardless of zones
    this.timerId = window.setInterval(() => {
      this.currentTime = new Date();
      this.tickCount++;
      // debug tick
      console.log('tick', this.tickCount, this.currentTime.toISOString());
      this.updatePrayerState();
      try { this.cdr.detectChanges(); } catch (e) { /* noop */ }
    }, 1000) as unknown as number;
  }

  ngOnDestroy(): void {
    this.clockSubscription?.unsubscribe();
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = undefined;
    }
  }

  private parseTime(timeStr: string, dayOffset = 0): Date {
    if (!timeStr) throw new Error('Empty time string');
    // Extract first HH:MM
    const m = timeStr.match(/(\d{1,2}):(\d{2})/);
    if (!m) throw new Error('Invalid time format: ' + timeStr);
    let hours = Number(m[1]);
    const minutes = Number(m[2]);
    const ampm = /\b(am|pm)\b/i.test(timeStr) ? timeStr.match(/\b(am|pm)\b/i)![1].toLowerCase() : null;
    if (ampm === 'pm' && hours < 12) hours += 12;
    if (ampm === 'am' && hours === 12) hours = 0;
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), today.getDate() + dayOffset, hours, minutes);
  }

  private updatePrayerTimesFromTimings(t: Timings): void {
    this.fajrTime = this.parseTime(t.Fajr);
    this.dhuhrTime = this.parseTime(t.Dhuhr);
    this.asrTime = this.parseTime(t.Asr);
    this.maghribTime = this.parseTime(t.Maghrib);
    this.ishaTime = this.parseTime(t.Isha);
  }

  private updatePrayerState(): void {
    if (!this.fajrTime || !this.dhuhrTime || !this.asrTime || !this.maghribTime || !this.ishaTime) return;

    const now = this.currentTime.getTime();

    // Create fajrTomorrow for the Isha -> next Fajr period
    const fajrTomorrow = this.parseTime(this.timings!.Fajr, 1);

    // Determine current prayer period by ordering the starts
    const periods: { name: string; start: Date }[] = [
      { name: 'Fajr', start: this.fajrTime },
      { name: 'Dhuhr', start: this.dhuhrTime },
      { name: 'Asr', start: this.asrTime },
      { name: 'Maghrib', start: this.maghribTime },
      { name: 'Isha', start: this.ishaTime },
    ];

    // Find the last period that started before now
    let found = 'Isha';
    for (let i = 0; i < periods.length; i++) {
      const start = periods[i].start.getTime();
      const nextStart = i < periods.length - 1 ? periods[i + 1].start.getTime() : fajrTomorrow.getTime();
      if (now >= start && now < nextStart) {
        found = periods[i].name;
        break;
      }
    }

    this.currentPrayer = found;

    // fasting considered from Fajr (start) to Maghrib (start)
    this.isFasting = now >= this.fajrTime.getTime() && now < this.maghribTime.getTime();
  }

  getBackgroundColor(): string {
    switch (this.currentPrayer) {
      case 'Fajr':
        return '#5f5cfa';
      case 'Dhuhr':
        return '#ffbb00';
      case 'Asr':
        return '#eb4640'; 
      case 'Maghrib':
        return '#6bff4d';
      case 'Isha':
      default:
        return '#000000'; 
    }
  }

  getStatus(): string {
    if (this.loading) return 'Loading...';

    let message: string;
    switch (this.currentPrayer) {
      case 'Fajr':
        message = 'May your prayer be accepted.';
        break;
      case 'Dhuhr':
        message = 'There is no god but Allah. Muhammad is the messenger of God.';
        break;
      case 'Asr':
        message = 'O Allah, send blessings upon Muhammad, the unlettered Prophet, and upon his family, and grant them best of peace.';
        break;
      case 'Maghrib':
        message = 'Recite Astaghfirullah  .';
        break;
      case 'Isha':
        message = 'To Allah, we belong, and to him, we will return.';
        break;
      default:
        message = 'Awaiting the next prayer.';
    }

    // always include a note about the current prayer
    return `${message} — current prayer: ${this.currentPrayer}`;
  }
}
