# Cyber Protection Act: red text changes

Published at https://news-netra.github.io/cyber-security-act/.

## Comparison with existing text

`comparison.html` compares `existing text.docx` against the complete Bengali draft. Spaces, tabs and line breaks are ignored; canonically equivalent Unicode forms are normalized to NFC. Punctuation, joiners, Gazette headers, page numbers and apparent transcription artifacts are retained as text differences.

- Red additions and red strikethroughs retain the source draft's markings where supported by the DOCX comparison.
- Blue marks additional draft text; purple strikethrough marks additional DOCX-only text.
- A yellow background flags original red marks whose addition/removal status is not confirmed by the comparison.
- Matching complete red edit groups are kept intact, avoiding false mismatches caused by shared letters inside replacement words. Exact, unique moved deletions are matched only within their corresponding section and identified in the reader.
- Expand a passage to read the DOCX and draft excerpts separately. Filters distinguish additional differences and original red marks needing review.

The comparison is a literal text comparison, including source transcription artifacts. Its counts describe displayed passages, not legal amendments. All three views (DOCX, physical draft redline, and draft with crossed text removed) are verified by reconstruction against their inputs. No source text is silently corrected.

The complete 28-page Bengali transcript is available at https://news-netra.github.io/cyber-security-act/full-bn.html, with a plain Unicode download at `full-bn.txt`. It includes every source line, with page navigation, individual-page copying and whole-document copying. Red text, strikethrough and bold are retained in the HTML. The text download uses form-feed characters between source pages and has no formatting.

The full transcript covers all 63,018 painted source glyphs exactly once, including 6,284 red glyphs. All 291 distinct Nikosh glyph outlines match the converter's reference font. No private-use or replacement characters remain. Source whitespace and wording are retained without manual correction.

`index.html` is a standalone bilingual reader with English selected by default and a prominent বাংলা toggle. It contains 64 marked excerpts: 32 with new text, 8 with crossed text, and 24 with both. Sentences and separately numbered list clauses retain their unchanged context.

- Red text indicates new wording; red strikethrough indicates crossed wording.
- Both languages use selectable, copyable Unicode. Copy buttons supply plain text and formatted HTML; receiving editors must support rich text to retain colour and strikethrough.
- Filters and copy actions apply to the selected language. English clause labels and section suffixes use Latin letters consistently throughout, including cross-references; nested labels use Roman numerals. Bengali identifiers remain unchanged in the Bengali version.
- There are no embedded fonts, remote assets, or build dependencies. The page works as a local HTML file as well as on GitHub Pages.

Source: `Final Version for Cabinet Meeting_updated 17.08.2026.pdf`. Bengali text was decoded from the PDF's Nikosh glyphs using the Nikosh Unicode converter. English was translated from that corrected text, with additions and deletions mapped to their corresponding English phrases. No OCR or image-based processing was used. Source inconsistencies, including Act/Ordinance wording, are retained.
