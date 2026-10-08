import { EntitySchema, MikroORM } from '@mikro-orm/sqlite';

class Company {
  id!: number;
  name!: string;
}
class CultureCompany extends Company {
  culture?: string;
}
class MediaCompany extends Company {
  media?: string;
}
class Posting {
  id!: number;
  company?: Company;
}

const CompanySchema = new EntitySchema({
  class: Company,
  discriminatorColumn: 'industry',
  properties: {
    id: { type: 'number', primary: true },
    name: { type: 'string' },
  },
});
const CultureSchema = new EntitySchema({
  class: CultureCompany,
  extends: Company,
  discriminatorValue: 'CULTURE',
  properties: { culture: { type: 'string', nullable: true } },
});
const MediaSchema = new EntitySchema({
  class: MediaCompany,
  extends: Company,
  discriminatorValue: 'MEDIA',
  properties: { media: { type: 'string', nullable: true } },
});
const PostingSchema = new EntitySchema({
  class: Posting,
  properties: {
    id: { type: 'number', primary: true },
    company: { kind: 'm:1', entity: () => Company, nullable: true },
  },
});

let orm: MikroORM;

beforeAll(async () => {
  orm = await MikroORM.init({
    dbName: ':memory:',
    entities: [CompanySchema, CultureSchema, MediaSchema, PostingSchema],
  });
  await orm.schema.create();
  const em = orm.em.fork();
  const culture = em.create(CultureCompany, { name: 'x', culture: 'c' });
  em.create(Posting, { company: culture });
  await em.flush();
});

afterAll(() => orm.close(true));

describe('joining into a non-abstract STI root', () => {
  test('nested filter on the joined root matches subtype rows', async () => {
    const em = orm.em.fork();
    const res = await em.find(Posting, { company: { name: 'x' } });
    expect(res).toHaveLength(1);
  });

  test('joined populate of the root relation loads subtype rows', async () => {
    const em = orm.em.fork();
    const res = await em.find(Posting, {}, { populate: ['company'], strategy: 'joined' });
    expect(res[0].company).toBeInstanceOf(CultureCompany);
  });

  test('join condition does not use the root discriminator value', () => {
    const sql = orm.em
      .createQueryBuilder(Posting, 'p')
      .select('p.id')
      .where({ company: { name: 'x' } })
      .getFormattedQuery();
    expect(sql).not.toContain(`= 'company'`);
  });
});
