const {resolve} = require('path');
const Storage = require('../index');

const storage = new Storage({
  name: 'test',
  filename: '.test',
  base: resolve(__dirname,'test/sub'),
});

(async () => {
  await storage.create({
    a: 'asd',
  });

  await storage.create({
    a: 123,
  });

  await storage.update({
    b: 123,
  }, {
    where: {
      a: 'asd',
    },
    limit: 1,
  });

  await storage.destroy({
    where: {
      a: 123,
    },
    limit: 1,
  });
})();
