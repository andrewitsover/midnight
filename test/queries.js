import { db } from './db.js';
import { strict as assert } from 'assert';
import { compare } from './utils.js';

const run = async () => {
  const cards = await db.cards.get({ eventId: 100 });
  const fighterId = await db.fighter.get({ name: /Israel/ }, 'id');

  compare(cards, 'cardsGet');
  assert.equal(fighterId, 17);

  const id = await db.coach.insert({
    name: 'Eugene Bareman',
    city: 'Auckland'
  });
  assert.equal(id, 1);
  const inserted = await db.coach.get({ id: 1 });
  assert.notEqual(inserted, undefined);
  assert.equal(inserted.city, 'Auckland');
  await db.coach.update({ id: 1 }, { city: 'Brisbane' });
  const updated = await db.coach.get({ id: 1 });
  assert.equal(updated.city, 'Brisbane');
  await db.coach.update({ id: 1 }, { city: 'δδδδδ' });
  const greek = await db.coach.get({ city: /\p{Script=Greek}+/u });
  assert.equal(greek.id, 1);
  await db.coach.remove({ id: 1 });
  const removed = await db.coach.get({ id: 1 });
  assert.equal(removed, undefined);
  const limited = await db.fighters.get(null, { limit: 10 });
  assert.equal(limited.length, 10);
  const israel = await db.fighter.get({ name: /israel/i }, ['name', 'id']);
  assert.equal(israel.id, 17);
}

const cleanUp = async () => {
  await db.coaches.remove();
}

export default {
  name: 'queries',
  run,
  cleanUp
};
