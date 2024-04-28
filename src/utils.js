export class Utils {
  parseUnixMillis(timeString) {
    const regex = /(\d+)\s*([dhms])/g;

    const timeUnitMillis = {
      d: 24 * 60 * 60 * 1000,
      h: 60 * 60 * 1000,
      m: 60 * 1000,
      s: 1000
    };

    let totalMillis = 0;
    let match;
    while ((match = regex.exec(timeString)) !== null) {
      const value = parseInt(match[1], 10);
      const unit = match[2];
      if (timeUnitMillis[unit]) {
        totalMillis += value * timeUnitMillis[unit];
      }
    }

    return totalMillis;
  }
}
