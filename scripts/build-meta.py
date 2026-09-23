"""Regenerate the machine-readable files from the HTML pages.

Writes llms.txt, llms-full.txt, sitemap.xml and notes/feed.xml.
Run it from the repository root after changing the content of the site:

    python scripts/build-meta.py

Needs Python 3.8+ and BeautifulSoup (pip install beautifulsoup4).
"""
import datetime as dt
import io
import os
import re
from xml.sax.saxutils import escape

from bs4 import BeautifulSoup, NavigableString, Tag

SITE = 'https://kanyeceejaya.github.io/'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TODAY = dt.date.today().isoformat()


def read(path):
    with io.open(os.path.join(ROOT, path), encoding='utf-8') as f:
        return f.read()


def write(path, text):
    with io.open(os.path.join(ROOT, path), 'w', encoding='utf-8', newline='\n') as f:
        f.write(text)
    print('wrote', path, len(text.encode('utf-8')), 'bytes')


def absolute(href, base=SITE):
    if not href or href.startswith(('http://', 'https://', 'mailto:')):
        return href
    if href.startswith('#'):
        return base + href
    if href.startswith('../'):
        return SITE + href[3:]
    return base + href


def md(el, base=SITE):
    """Inline HTML to Markdown: links, bold and italics; buttons and hidden bits dropped."""
    out = []
    for c in el.children:
        if isinstance(c, NavigableString):
            out.append(str(c))
        elif isinstance(c, Tag):
            if c.name in ('button', 'script', 'style', 'svg') or c.get('aria-hidden') == 'true':
                continue
            inner = md(c, base)
            if c.name == 'a' and c.get('href'):
                out.append('[%s](%s)' % (inner.strip(), absolute(c['href'], base)))
            elif c.name in ('strong', 'b'):
                out.append('**%s**' % inner.strip())
            elif c.name in ('em', 'i'):
                out.append('*%s*' % inner.strip())
            else:
                out.append(inner)
    return re.sub(r'\s+', ' ', ''.join(out)).strip()


def text(el, sel=None):
    node = el.select_one(sel) if sel else el
    return md(node) if node else ''


def section(soup, sid):
    return soup.find('section', id=sid)


# ------------------------------------------------------------------ home page
home = BeautifulSoup(read('index.html'), 'html.parser')
lede = text(home, '.hero .lede')
sub = text(home, '.hero .sub')
description = home.find('meta', attrs={'name': 'description'})['content']

full = ['# Akbr Kanyesigye', '', '> ' + description, '',
        'This is the full plain-text version of %s, generated from the site on %s. '
        'A shorter index lives at %sllms.txt.' % (SITE, TODAY, SITE), '',
        '## About', '', lede, '', sub, '']

full += ['## Now', '']
for li in section(home, 'now').select('.now-list li'):
    full.append('- ' + md(li))
full.append('')

full += ['## Work', '', 'Grouped by who the work serves.', '']
for block in section(home, 'work').select('.group-block'):
    full += ['### ' + text(block, 'h3.group'), '']
    for sheet in block.select('article.sheet'):
        title = text(sheet, '.sheet-title')
        meta = text(sheet, '.sheet-meta')
        full.append('#### %s (%s)' % (title, meta) if meta else '#### ' + title)
        full.append('')
        what = text(sheet, '.sheet-what')
        if what:
            full += [what, '']
        for p in sheet.select('.sheet-body > p'):
            cls = p.get('class') or []
            if 'sheet-what' in cls or 'stack' in cls:
                continue
            full += [md(p), '']
        facts = sheet.select('.facts li')
        if facts:
            for f in facts:
                full.append('- %s: %s' % (text(f, 'b'), text(f, 'span')))
            full.append('')
        stack = text(sheet, '.stack')
        if stack:
            full += ['Built with ' + stack, '']
        links = [a for a in sheet.select('.sheet-body > a.out')]
        if links:
            full += ['Links: ' + ', '.join('[%s](%s)' % (md(a), absolute(a['href'])) for a in links), '']
        shot = sheet.select_one('.sheet-media img')
        if shot:
            full += ['Screenshot: %s (%s)' % (shot.get('alt', ''), absolute(shot['src'])), '']

full += ['## Experience', '']
for ch in section(home, 'experience').select('.chapter'):
    full += ['### %s (%s)' % (text(ch, '.chapter-head h3'), text(ch, '.chapter-head span')), '']
    for entry in ch.select('.entry'):
        full += ['#### %s, %s (%s)' % (text(entry, 'h4'), text(entry, '.org'), text(entry, '.when')), '']
        gist = entry.select_one('.gist')
        if gist:
            full += [md(gist), '']
        for li in entry.select('details li'):
            full.append('- ' + md(li))
        if entry.select('details li'):
            full.append('')

full += ['## Education', '']
for grp in section(home, 'education').select('.edu-group'):
    full += ['### ' + text(grp, 'h3.group'), '']
    for li in grp.select('ul.edu > li'):
        line = '- **%s**, %s (%s)' % (text(li, '.what'), text(li, '.inst'), text(li, '.when'))
        grade = text(li, '.grade')
        if grade:
            line += '. ' + grade
        note = text(li, '.note')
        if note:
            line += '. ' + note
        full.append(line)
    full.append('')

full += ['## Papers and talks', '']
for grp in section(home, 'papers').select('.edu-group'):
    full += ['### ' + text(grp, 'h3.group'), '']
    for li in grp.select('ul.edu > li'):
        head = '- **%s** (%s' % (text(li, '.what'), text(li, '.when'))
        grade = text(li, '.grade')
        head += ', ' + grade.lower() + ')' if grade else ')'
        full.append(head + '. ' + text(li, '.inst') + '. ' + text(li, '.note'))
    full.append('')

full += ['## Recognition', '']
for li in section(home, 'recognition').select('.marks li'):
    what = li.select_one('.what')
    small = what.select_one('small')
    detail = md(small) if small else ''
    head = what.select_one('a, button')
    title = re.sub(r'\s+', ' ', head.get_text()).strip() if head else md(what)
    if head is not None and head.name == 'a' and head.get('href'):
        title = '[%s](%s)' % (title, absolute(head['href']))
    full.append('- %s: %s%s' % (text(li, '.year'), title, ' (%s)' % detail if detail else ''))
full.append('')

full += ['## Stories behind some of these', '']
for d in home.select('dialog.modal'):
    if d.get('id') == 'm-project':
        continue
    body = d.select_one('.modal-body')
    full += ['### ' + text(body, 'h2'), '']
    meta = text(body, '.modal-meta')
    if meta:
        full += [meta, '']
    for p in body.select('p, li'):
        if p.name == 'li':
            full.append('- ' + md(p))
            continue
        cls = p.get('class') or []
        if 'modal-meta' in cls:
            continue
        if 'modal-links' in cls:
            links = ', '.join('[%s](%s)' % (md(a), absolute(a['href'])) for a in p.select('a'))
            if links:
                full += ['Links: ' + links, '']
            continue
        full += [md(p), '']
    cap = d.select_one('figcaption')
    if cap:
        full += ['Photo caption: ' + md(cap), '']

full += ['## Toolkit', '']
for div in section(home, 'toolkit').select('.kit > div'):
    full.append('- **%s**: %s' % (text(div, 'dt'), text(div, 'dd')))
full.append('')

full += ['## Beyond work', '']
for li in section(home, 'beyond').select('.aside-list li'):
    full.append('- **%s**: %s' % (text(li, 'h3'), text(li, 'p')))
full.append('')

contact = section(home, 'contact')
full += ['## Contact', '', '- Email: kakbr800@gmail.com']
for a in contact.select('.ways a'):
    full.append('- %s: %s' % (md(a), a['href']))
full += ['- CV (PDF): ' + SITE + 'docs/Kanyesigye-Akbr-CV-2026.pdf', '']

# ------------------------------------------------------------------ notes
notes_index = BeautifulSoup(read('notes/index.html'), 'html.parser')
notes = []
for li in notes_index.select('.note-list li'):
    a = li.select_one('a')
    fn = a['href']
    page = BeautifulSoup(read('notes/' + fn), 'html.parser')
    t = page.select_one('time')
    body = page.select_one('.article .body')
    paras = []
    for el in body.find_all(['p', 'h2', 'blockquote', 'pre', 'li'], recursive=True):
        if el.name == 'h2':
            paras += ['### ' + md(el), '']
        elif el.name == 'blockquote':
            paras += ['> ' + md(el), '']
        elif el.name == 'pre':
            paras += ['```', el.get_text().strip(), '```', '']
        elif el.name == 'li':
            paras.append('- ' + md(el))
        elif el.find_parent('blockquote') is None:
            paras += [md(el), '']
    notes.append({
        'title': md(a), 'url': SITE + 'notes/' + fn, 'date': t['datetime'], 'human': md(t),
        'summary': text(li, 'p'),
        'description': page.find('meta', attrs={'name': 'description'})['content'],
        'body': paras, 'html': str(body)
    })

full += ['## Notes', '']
for n in notes:
    full += ['### ' + n['title'], '', '%s. %s' % (n['human'], n['url']), '']
    full += n['body']

write('llms-full.txt', '\n'.join(full).rstrip() + '\n')

# ------------------------------------------------------------------ llms.txt
short = [
    '# Akbr Kanyesigye', '',
    '> ' + description, '',
    'Akbr Kanyesigye (also written Kanyesigye Akbr) is a software and data engineer at the Uganda Bureau of Statistics in Kampala. '
    'He builds Sanyu, the Bureau\'s AI assistant over official statistics; the census e-recruitment and field staff system used for '
    'the 2024 National Population and Housing Census; and the dissemination portal for census results. He holds First Class degrees '
    'from Makerere University and Eastern Mediterranean University, graduating as class valedictorian in both, and is an AWS Certified '
    'Cloud Practitioner. Figures on this site come from his own work; cite the page they appear on.', '',
    'The whole site, including every project, role, paper and note, is in one Markdown file: [llms-full.txt](%sllms-full.txt)' % SITE, '',
    '## Pages', '',
    '- [Home](%s): work, experience, education, papers, recognition, toolkit and contact' % SITE,
    '- [Notes](%snotes/): short posts on data pipelines, AI over official statistics, and building for Uganda' % SITE,
    '- [CV](%sdocs/Kanyesigye-Akbr-CV-2026.pdf): the formal version, as a PDF' % SITE, '',
    '## Notes', '']
for n in notes:
    short.append('- [%s](%s): %s' % (n['title'], n['url'], n['summary'] or n['description']))
short += ['', '## Contact', '',
          '- Email: kakbr800@gmail.com',
          '- LinkedIn: https://www.linkedin.com/in/kanyesigye-akbr',
          '- GitHub: https://github.com/kanyeceejayA', '',
          '## Optional', '',
          '- [Full profile as plain text](%sllms-full.txt): everything on the site in one Markdown file, including the notes' % SITE]
write('llms.txt', '\n'.join(short).rstrip() + '\n')

# ------------------------------------------------------------------ sitemap
urls = [(SITE, TODAY, '1.0'), (SITE + 'notes/', max([n['date'] for n in notes] + ['2025-01-01']), '0.7')]
urls += [(n['url'], n['date'], '0.6') for n in notes]
sm = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
for loc, mod, pri in urls:
    sm.append('  <url><loc>%s</loc><lastmod>%s</lastmod><priority>%s</priority></url>' % (loc, mod, pri))
sm.append('</urlset>')
write('sitemap.xml', '\n'.join(sm) + '\n')

# ------------------------------------------------------------------ Atom feed for the notes
updated = max(n['date'] for n in notes) + 'T08:00:00Z' if notes else TODAY + 'T08:00:00Z'
feed = ['<?xml version="1.0" encoding="utf-8"?>',
        '<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="en-GB">',
        '  <title>Notes by Akbr Kanyesigye</title>',
        '  <subtitle>Short posts on data pipelines, AI over official statistics, and building for Uganda.</subtitle>',
        '  <link href="%snotes/feed.xml" rel="self" type="application/atom+xml"/>' % SITE,
        '  <link href="%snotes/" rel="alternate" type="text/html"/>' % SITE,
        '  <id>%snotes/</id>' % SITE,
        '  <updated>%s</updated>' % updated,
        '  <author><name>Akbr Kanyesigye</name><uri>%s</uri></author>' % SITE,
        '  <icon>%sfavicon.ico</icon>' % SITE]
for n in notes:
    body = re.sub(r'\s+', ' ', n['html'])
    body = body.replace('href="../', 'href="' + SITE).replace('href="./', 'href="' + SITE + 'notes/')
    feed += ['  <entry>',
             '    <title>%s</title>' % escape(n['title']),
             '    <link href="%s" rel="alternate" type="text/html"/>' % n['url'],
             '    <id>%s</id>' % n['url'],
             '    <published>%sT08:00:00Z</published>' % n['date'],
             '    <updated>%sT08:00:00Z</updated>' % n['date'],
             '    <summary>%s</summary>' % escape(n['description']),
             '    <content type="html">%s</content>' % escape(body),
             '  </entry>']
feed.append('</feed>')
write('notes/feed.xml', '\n'.join(feed) + '\n')
