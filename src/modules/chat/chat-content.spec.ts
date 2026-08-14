import {
  filterChatContent,
  parseBadWords,
} from './chat-content.util';

const cfg = (blockLinks: boolean, badWords: string[] = []) => ({
  blockLinks,
  badWords,
});

const ZW = String.fromCharCode(0x200b);

describe('chat content filter', () => {
  it('masks http/https links when link-blocking is on', () => {
    expect(filterChatContent('join http://scam.example/win now', cfg(true))).toBe(
      'join *** now',
    );
    expect(filterChatContent('go to https://a.b/c', cfg(true))).toBe('go to ***');
  });

  it('masks www. and bare known-TLD domains', () => {
    expect(filterChatContent('visit www.telegram.me/abc', cfg(true))).toBe(
      'visit ***',
    );
    expect(filterChatContent('open scam.win/join', cfg(true))).toBe('open ***');
    expect(filterChatContent('my ref is best-site.online', cfg(true))).toBe(
      'my ref is ***',
    );
  });

  it('does NOT mask plain decimals or non-link dots', () => {
    expect(filterChatContent('odds are 3.5 today', cfg(true))).toBe(
      'odds are 3.5 today',
    );
    expect(filterChatContent('good game 5.0 nice', cfg(true))).toBe(
      'good game 5.0 nice',
    );
  });

  it('leaves links untouched when link-blocking is off', () => {
    expect(filterChatContent('see http://ok.com', cfg(false))).toBe(
      'see http://ok.com',
    );
  });

  it('masks configured bad words case-insensitively', () => {
    expect(filterChatContent('you are a BadWord man', cfg(false, ['badword']))).toBe(
      'you are a *** man',
    );
  });

  it('applies both link and bad-word masking together', () => {
    expect(
      filterChatContent('spam www.x.com you idiot', cfg(true, ['idiot'])),
    ).toBe('spam *** you ***');
  });

  it('collapses whitespace and trims', () => {
    expect(filterChatContent('  hi   there \n friend ', cfg(true))).toBe(
      'hi there friend',
    );
  });

  it('a message that is only a link becomes the mask, not empty', () => {
    expect(filterChatContent('https://scam.win', cfg(true))).toBe('***');
  });

  it('parseBadWords splits on comma and newline, trims, drops blanks', () => {
    expect(parseBadWords('foo, bar\nbaz , , qux')).toEqual([
      'foo',
      'bar',
      'baz',
      'qux',
    ]);
    expect(parseBadWords('')).toEqual([]);
    expect(parseBadWords(null)).toEqual([]);
  });

  it('regex special chars in a bad word do not throw and match literally', () => {
    expect(filterChatContent('a+b and c.d', cfg(false, ['a+b', 'c.d']))).toBe(
      '*** and ***',
    );
  });

  it('strips zero-width obfuscation before masking links', () => {
    expect(
      filterChatContent(`open scam${ZW}.${ZW}win now`, cfg(true)),
    ).toBe('open *** now');
  });

  it('masks additional country TLDs', () => {
    expect(filterChatContent('visit scam.ru today', cfg(true))).toBe(
      'visit *** today',
    );
    expect(filterChatContent('go to scam.uk now', cfg(true))).toBe(
      'go to *** now',
    );
  });
});
