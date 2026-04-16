import { JSDOM } from "jsdom";
import {
  extractGenericBlocks,
  extractHackerNewsBlocks,
  extractXBlocks
} from "../src/content/extractors";

describe("extractors", () => {
  it("extracts only generic article-like blocks and skips code, short labels, and CJK text", () => {
    const dom = new JSDOM(`
      <body>
        <main>
          <p>  This is a fairly long paragraph that should be translated. </p>
          <h2>Feature overview</h2>
          <pre>const x = 1;</pre>
          <p>中文内容已经存在</p>
          <p>Like</p>
          <blockquote>Quoted content is also interesting to translate.</blockquote>
        </main>
      </body>
    `);

    const blocks = extractGenericBlocks(dom.window.document);

    expect(blocks.map((block) => block.text)).toEqual([
      "This is a fairly long paragraph that should be translated.",
      "Feature overview",
      "Quoted content is also interesting to translate."
    ]);
  });

  it("extracts x.com tweet bodies and replies while skipping navigation chrome", () => {
    const dom = new JSDOM(`
      <body>
        <nav>
          <a>Home</a>
        </nav>
        <article>
          <div data-testid="tweetText">Main post content worth translating.</div>
          <time>7h</time>
        </article>
        <article>
          <div data-testid="tweetText">Reply content should also be translated.</div>
          <button>Like</button>
        </article>
        <div data-testid="sidebarColumn">
          <section aria-labelledby="news-heading">
            <h2 id="news-heading" role="heading"><span>Today's News</span></h2>
            <div data-testid="trend">
              <span>News</span>
              <span>Pentagon in Talks with GM and Ford to Produce Weapons</span>
              <span>6 hours ago · News · 25.4K posts</span>
            </div>
          </section>
          <section aria-labelledby="what-heading">
            <h2 id="what-heading" role="heading"><span>What's happening</span></h2>
            <div data-testid="trend">
              <span>Sports · Trending</span>
              <span>Kawhi</span>
              <span>Trending with Clippers, Steph Curry</span>
            </div>
          </section>
        </div>
      </body>
    `);

    const blocks = extractXBlocks(dom.window.document);

    expect(blocks.map((block) => block.text)).toEqual([
      "Main post content worth translating.",
      "Reply content should also be translated.",
      "Today's News",
      "Pentagon in Talks with GM and Ford to Produce Weapons",
      "What's happening",
      "Kawhi",
      "Trending with Clippers, Steph Curry"
    ]);
  });

  it("extracts x.com sidebar news links even when they are not marked as trend cards", () => {
    const dom = new JSDOM(`
      <body>
        <div data-testid="sidebarColumn">
          <section>
            <h2><span>Today's News</span></h2>
            <a href="/i/news/1">
              <div dir="ltr">Spaceballs Sequel Titled 'SPACEBALLS: THE NEW ONE' Announced</div>
            </a>
            <a href="/i/news/2">
              <div dir="ltr">Pentagon in Talks with GM and Ford to Produce Weapons</div>
            </a>
          </section>
        </div>
      </body>
    `);

    const blocks = extractXBlocks(dom.window.document);

    expect(blocks.map((block) => block.text)).toEqual([
      "Today's News",
      "Spaceballs Sequel Titled 'SPACEBALLS: THE NEW ONE' Announced",
      "Pentagon in Talks with GM and Ford to Produce Weapons"
    ]);
  });

  it("extracts x.com longform status detail text when tweetText is absent", () => {
    const dom = new JSDOM(`
      <body>
        <main>
          <article data-testid="tweet">
            <div data-testid="User-Name">
              <span>Google AI Studio</span>
            </div>
            <time>Jul 13</time>
            <div>
              <div dir="auto">
                A quick tour of the new Gemini workflow tools is here.
              </div>
              <div dir="auto">
                You can now chain prompts, inspect intermediate outputs, and iterate without leaving the canvas.
              </div>
              <div dir="auto">
                This longform post should be translated even though tweetText is not present.
              </div>
            </div>
            <div data-testid="like">1.2K</div>
          </article>
        </main>
      </body>
    `);

    const blocks = extractXBlocks(dom.window.document);

    expect(blocks.map((block) => block.text)).toEqual([
      "A quick tour of the new Gemini workflow tools is here.",
      "You can now chain prompts, inspect intermediate outputs, and iterate without leaving the canvas.",
      "This longform post should be translated even though tweetText is not present."
    ]);
  });

  it("extracts x.com status detail longform fallback even when a short tweetText summary exists", () => {
    const dom = new JSDOM(`
      <body>
        <main>
          <article data-testid="tweet">
            <div data-testid="tweetText">Short summary from the post card.</div>
            <div>
              <div dir="auto">
                Here is the expanded status detail paragraph that should still be translated.
              </div>
              <div dir="auto">
                Another long paragraph from the same status detail view that lives outside tweetText.
              </div>
            </div>
          </article>
        </main>
      </body>
    `);

    const blocks = extractXBlocks(dom.window.document);

    expect(blocks.map((block) => block.text)).toEqual([
      "Short summary from the post card.",
      "Here is the expanded status detail paragraph that should still be translated.",
      "Another long paragraph from the same status detail view that lives outside tweetText."
    ]);
  });

  it("extracts hacker news story titles and comment bodies from table-based layouts", () => {
    const dom = new JSDOM(`
      <body>
        <center>
          <table id="hnmain">
            <tr class="athing">
              <td class="title">
                <span class="titleline">
                  <a href="https://example.com/story">A long Hacker News story title worth translating</a>
                </span>
              </td>
            </tr>
            <tr>
              <td>
                <span class="subline">
                  <a href="item?id=1">42 comments</a>
                </span>
              </td>
            </tr>
            <tr class="athing comtr">
              <td>
                <span class="commtext">
                  This is a substantial Hacker News comment that should also be translated.
                </span>
              </td>
            </tr>
          </table>
        </center>
      </body>
    `);

    const blocks = extractHackerNewsBlocks(dom.window.document);

    expect(blocks.map((block) => block.text)).toEqual([
      "A long Hacker News story title worth translating",
      "This is a substantial Hacker News comment that should also be translated."
    ]);
  });
});
