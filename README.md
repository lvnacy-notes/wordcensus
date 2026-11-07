# Word Census

An [Obsidian](https://obsidian.md) plugin that counts words only inside a region of a note, not the whole thing. Mark the region with a pair of comments or point the plugin at a heading, and Word Census counts what's there: in a sidebar panel with a stopwatch, a countdown and a writing-session timer, in an inline `wordcount` block you can place anywhere, and in the status bar on desktop.

It's built for people who keep notes, outlines and drafts in the same file and want to know how long the draft itself is. It works on mobile as well as desktop.

## CI flags

> **Placeholder.** These status badges will be added once CI is set up.

<!--
| Check | Status |
|-------|--------|
| Lint | _pending_ |
| Typecheck | _pending_ |
| Tests | _pending_ |
| Build | _pending_ |
| Coverage | _pending_ |
| Latest release | _pending_ |
-->

## Features

### Count a region, not a whole note

- **Between markers.** Wrap the part you want counted in `<!-- word count start -->` and `<!-- word count end -->`. A note can hold several pairs, and their counts are added together.
- **Under a heading.** Name a heading and Word Census counts everything beneath it, subheadings included, until the next heading of the same or a higher level. Set one heading globally in the settings, or override it for a single note with a `word-count-heading` property.
- **Whole note.** With neither in place, the whole note is counted.

Markers take precedence over a heading. A heading that can't be found shows "Heading not found" instead of quietly counting the whole note.

### What counts as a word

Frontmatter, comments (`<!-- -->` and `%% %%`), Markdown syntax and link URLs are never counted. Link text is. Three things are up to you:

- **Include code blocks** (off by default): words inside fenced code blocks.
- **Include footnotes** (on by default): the text of footnote definitions.
- **Include embeds** (off by default): the text of embed links.

Hyphenated words and contractions count as one word. Chinese, Japanese, Thai and other scripts written without spaces are segmented properly where the device supports it.

### Sidebar panel and timers

Open it with the **Open word count panel** command. It shows the region's count and which mode matched, an analog clock, and three timers that run independently of one another:

- **Stopwatch** for elapsed time.
- **Countdown** that stops at zero and tells you it's finished. The default length is configurable.
- **Session** that binds to the note you start it in and tracks words written and words per minute, counting only the time it was running. It follows the note if you rename or move it. If the note is deleted, the session ends and keeps its final figures until you reset it.

Elapsed time comes from timestamps, so timers stay accurate when a mobile app is in the background. Timers can optionally be kept across restarts; a timer that was running comes back paused.

### Inline `wordcount` block

Put this anywhere in a note to show its live count in place:

````markdown
```wordcount
```
````

To count under a particular heading instead, add a `heading:` line:

````markdown
```wordcount
heading: Chapter 3
```
````

The block never counts itself.

### Status bar

On desktop, the status bar shows the active note's count. It can be turned off in the settings.

## Settings

| Setting | What it does |
|---------|--------------|
| Heading | Count only the words under this heading when a note has no markers. Leave blank to count the whole note. |
| Include code blocks | Count words inside fenced code blocks. |
| Include footnotes | Count the text of footnote definitions. |
| Include embeds | Count the text of embed links. |
| Default countdown | Minutes the countdown starts from. |
| Keep timer across restarts | Save the timer and bring it back, paused, when Obsidian reopens. |
| Show status bar item | Show the word count in the status bar. Desktop only. |

## Installation

Word Census isn't in the community plugin directory yet. To install it by hand, download `main.js`, `manifest.json` and `styles.css` from the [latest release](https://github.com/lvnacy-notes/wordcensus/releases) once one is published, put them in `<your vault>/.obsidian/plugins/wordcensus/`, and enable the plugin under **Settings → Community plugins**.

Word Census needs Obsidian 1.13.0 or later.

## Development

Requires Node 24 or later and [pnpm](https://pnpm.io).

```sh
pnpm install
pnpm dev          # rebuild on change
pnpm test         # run the tests
pnpm lint
pnpm typecheck
pnpm build        # typecheck, then a production build into dist/
```

The design and its reasoning are in [docs/SPEC.md](docs/SPEC.md), and the testing approach is in [docs/TESTING.md](docs/TESTING.md).

## Contributing

This project is **not accepting pull requests at this time.** Please don't open one; it will be closed without review. This may change later, and this section will be updated if it does.

## License

[MIT](LICENSE) © 2026 L V N A C Y