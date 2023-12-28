import csv from "csvtojson";
import AhoCorasick from "ahocorasick";

export const createGlossaryMatcher = async () => {
  const glossary = await getGlossary();
  // https://github.com/BrunoRB/ahocorasick
  const ac = new AhoCorasick(Object.keys(glossary).filter((t) => !!t));
  return (text) => {
    const results = ac
      .search(text)
      .map((matched) => matched[1])
      .flat();
    return results.reduce((prev, current) => {
      prev[current] = glossary[current];
      return prev;
    }, {});
  };
};

/**
 * Glossary example:
 * {
    field1: 'No.',
    field2: 'Source Language [EN]',
    field3: 'Target Language [JP]',
    field4: 'PE course: 101',
    field5: 'Doc',
    field6: 'Note',
    field7: '',
    field8: '',
    field9: '',
    field10: '',
    field11: '',
    field12: '',
    field13: '',
    field14: '',
    field15: '',
    field16: '',
    field17: '',
    field18: '',
    field19: '',
    field20: '',
    field21: '',
    field22: '',
    field23: ''
  },
  {
    field1: '1',
    field2: 'collation',
    field3: '照合順序',
    field4: 'OK',
    field5: 'OK',
    field6: 'MySQLの機械翻訳で「照合順序」と訳しています。日本語ページ: https://dev.mysql.com/doc/refman/8.0/ja/charset-mysql.html 英語ページ: https://dev.mysql.com/doc/refman/8.0/en/charset-mysql.html / "10.2 MySQL での文字セットと照合順序" "10.2 Character Sets and Collations in MySQL"',
    field7: '',
    field8: '',
    field9: '',
    field10: '',
    field11: '',
    field12: '',
    field13: '',
    field14: '',
    field15: '',
    field16: '',
    field17: '',
    field18: '',
    field19: '',
    field20: '',
    field21: '',
    field22: '',
    field23: ''
  }

	Return: { k: v, ... }
 */
const getGlossary = async () => {
  const csvContent = await csv().fromFile("./src/glossary.csv");
  const headerIndex = csvContent.findIndex((item) => item.field1 === "No.");
  const glossary = csvContent.slice(headerIndex + 1).reduce((prev, current) => {
    prev[current.field2] = current.field3;
    return prev;
  }, {});

  return glossary;
};
