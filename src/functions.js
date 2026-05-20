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
    lambda: (blob) => blob.toBase64()
  },
  {
    name: 'regex',
    lambda: (text, source, flags) => {
      const key = `/${source}/${flags}`;
      let pattern = cache.get(key);
      if (!pattern) {
        pattern = new RegExp(source, flags);
        cache.set(key, pattern);
      }
      return pattern.test(text) ? 1 : 0;
    }
  }
];

export default functions;
