const cache = new Map();

const functions = [
  {
    name: 'temporal_now_instant',
    function: () => Temporal.Now.instant().toString()
  },
  {
    name: 'temporal_now_plain_date',
    function: () => Temporal.Now.plainDateISO().toString()
  },
  {
    name: 'temporal_now_plain_date_time',
    function: () => Temporal.Now.plainDateTimeISO().toString()
  },
  {
    name: 'temporal_now_plain_time',
    function: () => Temporal.Now.plainTimeISO().toString()
  },
  {
    name: 'temporal_now_zoned_date_time',
    function: () => Temporal.Now.zonedDateTimeISO().toString()
  },
  {
    name: 'base64',
    function: (blob) => blob === null ? null : blob.toBase64()
  },
  {
    name: 'regex',
    function: (text, source, flags) => {
      if (text === null || source === null) {
        return null;
      }
      const key = `/${source}/${flags}`;
      let regex = cache.get(key);
      if (!regex) {
        regex = new RegExp(source, flags);
        cache.set(key, regex);
      }
      return regex.test(text) ? 1 : 0;
    }
  },
  {
    name: 'temporal_compare',
    function: (a, b) => {
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
    function: (text) => {
      if (text === null) {
        return null;
      }
      const date = Temporal.ZonedDateTime.from(text);
      return date.epochNanoseconds;
    }
  }
];

export default functions;
