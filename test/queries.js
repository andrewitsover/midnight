import { db } from './db.js';
import { strict as assert } from 'assert';
import { compare } from './utils.js';

const run = async () => {
  const cards = await db.cards.many({ eventId: 100 });
  const fighterId = await db.fighters.get({ name: s => s.like('Israel%') }, 'id');

  compare(cards, 'cardsGet');
  assert.equal(fighterId, 17);

  const id = await db.coaches.insert({
    name: 'Eugene Bareman',
    city: 'Auckland'
  });
  assert.equal(id, 1);
  const inserted = await db.coaches.get({ id: 1 });
  assert.notEqual(inserted, undefined);
  assert.equal(inserted.city, 'Auckland');
  await db.coaches.update({
    where: { id: 1 },
    set: { city: 'Brisbane' }
  });
  const updated = await db.coaches.get({ id: 1 });
  assert.equal(updated.city, 'Brisbane');
  await db.coaches.remove({ id: 1 });
  const removed = await db.coaches.get({ id: 1 });
  assert.equal(removed, undefined);
  const limited = await db.fighters.query({ limit: 10 });
  assert.equal(limited.length, 10);
  const profiles = await db.fighterProfiles.query({
    where: { 
      fighterProfiles: 'Sao'
    },
    highlight: { 
      column: 'hometown', 
      tags: ['<b>', '</b>'] 
    }, 
    bm25: { 
      name: 1, 
      hometown: 10 
    },
    limit: 5
  });
  compare(profiles, 'fighterProfiles');
  await db.coaches.remove();
  await db.coaches.insert({ name: 'Andrew', city: 'Brisbane' });
  await db.coaches.insert({ name: 'Andrew', city: 'Brisbane' });
  await db.coaches.update({
    where: { name: 'Andrew' },
    set: { name: 'Eugene' }
  });
  const count = await db.coaches.count({ name: 'Eugene' });
  assert.equal(count, 2);
  await db.coaches.remove();
  const fighterCount = await db.fighters.count({ id: n => n.range({ gt: 10, lt: 15 }) });
  assert.equal(fighterCount, 4);
  const whereSelector = await db.fighters.get({ social: s => s.instagram.eq('angga_thehitman') });
  assert.equal(whereSelector.id, 2);
  const accounts = await db.fighters.many({ id: n => n.lt(10) }, c => c.social.instagram);
  assert.equal(accounts.at(6), 'makamboabedi');
  const orderBy = await db.fighters.query({
    where: {
      id: n => n.lt(10)
    },
    select: ['id', 'born', { select: s => s.social.instagram, as: 'instagram' }],
    orderBy: 'instagram'
  });
  assert.equal(orderBy.at(2).instagram, 'angga_thehitman');
  const selector = await db.fighters.get({ id: 2 }, ['id', 'born', { select: c => c.social.instagram, as: 'instagram' }]);
  assert.equal(selector.instagram, 'angga_thehitman');
  const rows = [];
  for (let i = 0; i < 5; i++) {
    rows.push({
      name: 'test',
      city: 'test'
    });
  }
  await db.coaches.insertMany(rows);
  const insertCount = await db.coaches.count();
  assert.equal(insertCount, 5);
  await db.coaches.remove();
  const phone = await db.fighters.get({ 
    id: 5, 
    phone: p => p.includes('0430 473 923') 
  });
  assert.equal(phone !== undefined, true);
  const document = await db.fighters.get({ 
    id: 521,
    documents: d => d.some(f => f.documentId.eq(32)) 
  });
  assert.equal(document !== undefined, true);
  const file = await db.fighters.get({
    id: 65,
    documents: d => d.some(v => v.files.some(f => f.name.eq('filename2.jpg'))) 
  });
  assert.equal(file !== undefined, true);
  const phoneTest = await db.fighters.get({ 
    id: 5, 
    phone: p => p.some(v => v.like('% 473 923')) 
  });
  assert.equal(phoneTest !== undefined, true);
  const upsertId = await db.coaches.insert({
    name: 'Test User',
    city: 'Test City'
  });
  await db.coaches.upsert({
    values: {
      id: upsertId,
      name: 'Not User',
      city: 'Not City'
    },
    target: 'id',
    set: {
      city: 'Updated City'
    }
  });
  const upsert = await db.coaches.get({ id: upsertId });
  assert.equal(upsert.city, 'Updated City');
  await db.coaches.remove();
  const first = await db.fighters.first({
    where: {
      id: 3
    }
  });
  assert.equal(first.id, 3);
  const locations = await db.locations.query({
    include: {
      events: (t, c) => t.events.many({ locationId: c.id })
    }
  });
  console.log(locations);
}

const cleanUp = async () => {
  await db.coaches.remove();
}

export default {
  name: 'queries',
  run,
  cleanUp
};
