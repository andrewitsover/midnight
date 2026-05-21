const cache = new Map();

const functions = [
  {
    name: 'temporal_now_instant',
    lambda: () => Temporal.Now.instant().toString()
  },
  {
    name: 'temporal_now_plain_date',
    lambda: () => Temporal.Now.plainDateISO().toString()
  },
  {
    name: 'temporal_now_plain_date_time',
    lambda: () => Temporal.Now.plainDateTimeISO().toString()
  },
  {
    name: 'temporal_now_plain_time',
    lambda: () => Temporal.Now.plainTimeISO().toString()
  },
  {
    name: 'temporal_now_zoned_date_time',
    lambda: () => Temporal.Now.zonedDateTimeISO().toString()
  },
  {
    name: 'base64',
    lambda: (blob) => blob === null ? null : blob.toBase64()
  },
  {
    name: 'regex',
    lambda: (text, source, flags) => {
      if (text === null || source === null) {
        return null;
      }
      const key = `/${source}/${flags}`;
      let pattern = cache.get(key);
      if (!pattern) {
        pattern = new RegExp(source, flags);
        cache.set(key, pattern);
      }
      return pattern.test(text) ? 1 : 0;
    }
  },
  {
    name: 'temporal_compare',
    lambda: (a, b) => {
      if (a === null || b === null) {
        return null;
      }
      const { from, compare } = Temporal.ZonedDateTime;
      const d = from(a);
      const e = from(b);
      return compare(d, e);
    }
  },
  {
    name: 'temporal_nanoseconds',
    lambda: (text) => {
      if (text === null) {
        return null;
      }
      const date = Temporal.ZonedDateTime.from(text);
      return date.epochNanoseconds;
    }
  }
];

export default functions;
