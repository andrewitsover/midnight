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
  }
];

export default functions;
