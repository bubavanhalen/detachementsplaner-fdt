"""Build the offline app into one deployable, shareable HTML file."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'src'


def build():
    shell = (SOURCE / 'shell.html').read_text(encoding='utf-8')
    css = (SOURCE / 'styles.css').read_text(encoding='utf-8')
    modules = ['vendor/xlsx.js', 'core.js', 'person-helpers.js', 'import.js', 'views.js', 'planning.js', 'contacts.js', 'app.js']
    scripts = '\n'.join('<script>\n' + (SOURCE / name).read_text(encoding='utf-8') + '\n</script>' for name in modules)
    result = shell.replace('<!--STYLES-->', '<style>\n' + css + '\n</style>').replace('<!--SCRIPTS-->', scripts)
    (ROOT / 'index.html').write_text(result, encoding='utf-8')
    print(f'Built index.html from {len(modules)} modules (offline, no external assets).')


if __name__ == '__main__':
    build()
