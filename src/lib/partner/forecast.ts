export type NightObservation = {
  date: string;
  bookings: number;
  guests: number;
  admitted: number;
  intent: number;
  event: boolean;
  leadHours: number[];
  arrivalSlots: number[];
  bookingSlots?: number[];
  confirmationMinutes: number[];
  offerBookings: number;
  promotionActive?: boolean;
};

export function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return (sorted[middle] + sorted[Math.floor((sorted.length - 1) / 2)]) / 2;
}

const weekday = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay();
const average = (values: number[]) => values.reduce((total, value) => total + value, 0) / values.length;

function similarNights(history: NightObservation[], date: string, event: boolean) {
  const eventNights = history.filter((night) => night.event === event);
  const sameWeekday = eventNights.filter((night) => weekday(night.date) === weekday(date));
  return (sameWeekday.length >= 3 ? sameWeekday : eventNights).slice(-8);
}

function aggregateSlots(nights: NightObservation[], key: "arrivalSlots" | "bookingSlots") {
  return [0, 1, 2].map((slot) => nights.reduce((sum, night) => sum + (night[key]?.[slot] ?? 0), 0));
}

function distribute(counts: number[], total: number) {
  const observations = counts.reduce((sum, count) => sum + count, 0);
  if (!observations) return null;
  let cumulative = 0;
  return counts.map((count) => {
    const previous = Math.round(total * cumulative / observations);
    cumulative += count;
    return Math.round(total * cumulative / observations) - previous;
  });
}

export function forecastNight(input: {
  history: NightObservation[];
  date: string;
  event: boolean;
  intent: number;
  bookedGuests: number;
  bookingCount: number;
  remaining: number;
  open: boolean;
  linkedViewers?: number;
  convertedViewers?: number;
  hoursUntil?: number;
}) {
  const history = [...input.history].sort((a, b) => a.date.localeCompare(b.date));
  const comparable = similarNights(history, input.date, input.event);
  const guests = history.reduce((sum, night) => sum + night.guests, 0);
  const admitted = history.reduce((sum, night) => sum + night.admitted, 0);
  const leadTime = median(history.flatMap((night) => night.leadHours));
  const confirmation = median(history.flatMap((night) => night.confirmationMinutes));
  const offerBookings = history.reduce((sum, night) => sum + night.offerBookings, 0);
  const showRate = guests ? Math.min(1, admitted / guests) : null;

  // Rolling holdout: each prediction uses only nights before the observed night.
  const errors = history.flatMap((night, index) => {
    const prior = similarNights(history.slice(0, index), night.date, night.event);
    return prior.length >= 3
      ? [Math.abs(average(prior.map((item) => item.admitted)) - night.admitted)]
      : [];
  });
  const promotionPairs = history.filter((night) => night.promotionActive).flatMap((night) => {
    const baseline = history.filter((other) => !other.promotionActive &&
      other.event === night.event && weekday(other.date) === weekday(night.date));
    return baseline.length ? [{ booked: night.bookings, baseline: average(baseline.map((item) => item.bookings)) }] : [];
  });
  const baselineBookings = promotionPairs.reduce((sum, row) => sum + row.baseline, 0);
  const metrics = {
    leadTime,
    confirmation,
    offerBookings,
    offerLift: promotionPairs.length >= 3 && baselineBookings > 0
      ? promotionPairs.reduce((sum, row) => sum + row.booked, 0) / baselineBookings - 1
      : null,
    showRate,
    conversion: input.linkedViewers ? (input.convertedViewers ?? 0) / input.linkedViewers : null,
    meanError: errors.length ? average(errors) : null,
    forecastsEvaluated: errors.length,
  };
  if (comparable.length < 3 || !comparable.some((night) => night.bookings > 0)) return { comparable: comparable.length, metrics, estimate: null };

  const historicIntent = average(comparable.map((night) => night.intent));
  const intentFactor = historicIntent && input.intent
    ? Math.min(1.3, Math.max(0.8, 1 + 0.2 * (input.intent / historicIntent - 1)))
    : 1;
  const baselineBookingsForNight = average(comparable.map((night) => night.bookings)) * intentFactor;
  const leadHours = comparable.flatMap((night) => night.leadHours);
  const hoursUntil = input.hoursUntil;
  const currentPace = hoursUntil === undefined || leadHours.length < 8
    ? 0 : leadHours.filter((hours) => hours >= hoursUntil).length / leadHours.length;
  const paceEstimate = currentPace >= 0.25 && input.bookingCount
    ? Math.min(input.bookingCount / currentPace, baselineBookingsForNight * 1.5) : null;
  const bookingForecast = Math.max(input.bookingCount, Math.round(paceEstimate === null
    ? baselineBookingsForNight : baselineBookingsForNight * 0.7 + paceEstimate * 0.3));
  const comparableBookings = comparable.reduce((sum, night) => sum + night.bookings, 0);
  const guestsPerBooking = comparable.reduce((sum, night) => sum + night.guests, 0) / comparableBookings;
  const guestForecast = Math.max(input.bookedGuests, Math.round(bookingForecast * guestsPerBooking));
  const attendance = Math.round(guestForecast * (showRate ?? 1));
  const arrivalSlots = distribute(aggregateSlots(comparable, "arrivalSlots"), attendance);
  const bookingSlots = distribute(aggregateSlots(comparable, "bookingSlots"), bookingForecast);
  const incremental = guestForecast - input.bookedGuests;
  const recommendation = !input.open
    ? "Bookings are paused. Review availability before reopening for this night."
    : input.remaining === 0 || (incremental > 0 && input.remaining <= incremental)
      ? "Sell-out risk. Check door capacity and release more inventory only if the venue can accommodate it."
      : incremental < input.remaining * 0.35
        ? "Likely underfilled. Review a promo code or an early-arrival offer for the quietest window."
        : "Demand is in line with available inventory. Keep monitoring bookings and check-ins.";

  return {
    comparable: comparable.length,
    metrics,
    estimate: { bookings: bookingForecast, attendance, arrivalSlots, bookingSlots, recommendation },
  };
}
