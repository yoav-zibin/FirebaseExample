const parse = require('csv-parse/lib/sync')
fs = require('fs')
fs.readFile('NYU Spring 2018 - All games.csv', 'utf8', function (err,data) {
  if (err) {
    return console.log(err);
  }
  // console.log(data);
  var records = parse(data, {columns: true});
  // console.log(records);
  /*
  { GameSpecID: '-L-_249g8mD8e8K-1L6T',
    'Game name': 'L-Game',
    'Better game name': '',
    'Should delete?': '',
    'Game wiki link': 'https://en.wikipedia.org/wiki/L_game',
    Owner: 'Sisi',
    Votes: '',
    'Comments/issues': 'None' },
    */
  for (let record of records) {
    console.log(record['Game name']);
  }
});

