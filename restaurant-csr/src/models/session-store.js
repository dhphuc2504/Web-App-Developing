import session from "express-session";
export class PrismaSessionStore extends session.Store {
  constructor(db) {
    super();
    this.db = db;
  }
  get(sid, done) {
    this.db.session
      .findUnique({ where: { sid } })
      .then((row) => {
        if (!row || row.expires <= new Date()) return done(null, null);
        try {
          done(null, JSON.parse(row.data));
        } catch {
          done(new Error("Session unavailable"));
        }
      })
      .catch(() => done(new Error("Session unavailable")));
  }
  set(sid, value, done = () => {}) {
    const expires = value.cookie?.expires
      ? new Date(value.cookie.expires)
      : new Date(Date.now() + 8 * 60 * 60 * 1000);
    const data = JSON.stringify(value);
    this.db.session
      .upsert({
        where: { sid },
        create: { sid, data, expires },
        update: { data, expires },
      })
      .then(() => done())
      .catch(() => done(new Error("Session unavailable")));
  }
  destroy(sid, done = () => {}) {
    this.db.session
      .deleteMany({ where: { sid } })
      .then(() => done())
      .catch(() => done(new Error("Session unavailable")));
  }
  touch(sid, value, done = () => {}) {
    const expires = new Date(
      value.cookie.expires || Date.now() + 8 * 60 * 60 * 1000,
    );
    this.db.session
      .updateMany({ where: { sid }, data: { expires } })
      .then(() => done())
      .catch(() => done(new Error("Session unavailable")));
  }
  async prune() {
    await this.db.session.deleteMany({
      where: { expires: { lt: new Date() } },
    });
  }
}
