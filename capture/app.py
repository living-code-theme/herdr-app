"""Real Herdr App + isolated core. Only local source/Git/ANSI fixtures; no agent account."""
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import time

GRAPHICAL = True


def prepare(c):
    c.git_fixture()
    app_home = c.home / '.config/herdr-app'
    c.env.update(HERDR_APP_HOME=str(app_home), HC_SESSION='lc-port-capture',
                 HERDR_TELEMETRY='0', DO_NOT_TRACK='1', HERDR_APP_NO_SOUND='1')
    # GPUI's Vulkan backend must use the locked software ICD, not a host GPU.
    mesa = Path(os.environ['CAPTURE_MESA'])
    icd, = mesa.glob('share/vulkan/icd.d/lvp_icd.x86_64.json')
    c.env['VK_DRIVER_FILES'] = str(icd)
    c.env['VK_ICD_FILENAMES'] = str(icd)
    c.env['XDG_SESSION_TYPE'] = 'x11'
    c.copy(f'themes/{c.slug}.json', f'.config/herdr-app/themes/{c.slug}.json')
    c.write('.config/herdr-app/settings.json', json.dumps({
        'zoom': 2, 'appearance': 'light' if c.flavor['light'] else 'dark',
        'theme': c.slug, 'font': 'DejaVu Sans Mono', 'font_size': 13,
        'ui_font': 'DejaVu Sans', 'telemetry': False,
    }))
    c.write('.config/herdr-app/shared.json', json.dumps({'frame.welcomed': 'capture'}))
    c.write('.config/herdr-app/update-notes.json', json.dumps({
        'last_run': '0.1.11', 'presented': ['0.1.11'],
    }))
    # Herdr may launch through a login shell: use the locked tools' absolute
    # paths instead of allowing that shell's profile to substitute host tools.
    tools = {name: shutil.which(name, path=c.env['PATH']) for name in ('bash', 'bat', 'git', 'sleep')}
    assert all(tools.values()), tools
    c.capture_tools = tools
    def script(name, body):
        for tool, executable in tools.items():
            body = body.replace(f'@{tool}@', executable)
        return c.write(name, 'set -eu\n' + body)

    script('source.sh', r'''printf '\033[2J\033[H\033]2;FieldRenderer.ts\007'
printf '\033[36m%s\033[0m\n\n' '$ bat src/FieldRenderer.ts'
@bat@ --theme=ansi --style=numbers --paging=never --color=always src/FieldRenderer.ts
printf '\n\033[90m%s\033[0m\n' 'Local source preview · no model calls'
exec @sleep@ 300
''')
    script('review.sh', r'''printf '\033[2J\033[H\033]2;Git review · local demo\007'
printf '\033[36m%s\033[0m\n\n' '$ git status --short'
@git@ -c color.ui=always status --short
printf '\n\033[36m%s\033[0m\n\n' '$ git diff -- src/FieldRenderer.ts'
@git@ --no-pager -c color.ui=always diff -- src/FieldRenderer.ts
printf '\n\033[36m%s\033[0m\n\n' 'Terminal ANSI palette'
for color in 30 31 32 33 34 35 36 37; do printf '\033[%sm Aa \033[0m' "$color"; done
printf '\n'
for color in 90 91 92 93 94 95 96 97; do printf '\033[%sm Aa \033[0m' "$color"; done
printf '\n\n\033[90m%s\033[0m\n' 'Local demo · waiting for review'
printf '\033]7501;state=blocked:app=local-demo\033\\'
exec @sleep@ 300
''')
    status = json.loads(c.run(['hc', 'server', 'start', '--json']))
    assert status['installed_by'] == 'nix', status
    return ['herdr-app']


def action(c, name, args):
    result = json.loads(c.run(['herdr-app', 'do', name, json.dumps(args)]))
    if result.get('error'):
        raise RuntimeError(result)
    return result


def world(c):
    return json.loads(c.run(['herdr-app', 'ls']))


def wait(c, predicate, description, timeout=45):
    deadline = time.monotonic() + timeout
    last = None
    while time.monotonic() < deadline:
        try:
            last = predicate()
            if last:
                return last
        except (subprocess.CalledProcessError, FileNotFoundError, json.JSONDecodeError):
            pass
        time.sleep(0.2)
    raise RuntimeError(f'Herdr did not reach {description}: {last}')


def drive(c):
    windows = wait(c, lambda: c.run(['xdotool', 'search', '--onlyvisible', '--class', 'herdr-app']).split(), 'native X11 window')
    window = windows[-1]
    c.run(['xdotool', 'windowsize', window, '2560', '1600'])
    c.run(['xdotool', 'windowmove', window, '0', '0'])
    c.run(['xdotool', 'windowfocus', window])
    wait(c, lambda: json.loads(c.run(['herdr-app', 'status'])), 'control socket')
    # Exercise the documented native theme-picker command, not just JSON parsing.
    action(c, 'app.theme', {'name': c.slug})
    action(c, 'space.new', {
        'name': 'Glyph field', 'tab': 'Source & review', 'folder': str(c.work),
        'argv': [c.capture_tools['bash'], str(c.home / 'source.sh')],
    })
    wait(c, lambda: any(s['name'] == 'Glyph field' and s['tabs'] for s in world(c)['spaces']), 'fixture space')
    action(c, 'pane.split', {'direction': 'right', 'argv': [c.capture_tools['bash'], str(c.home / 'review.sh')]})

    def rendered():
        state = world(c)
        space = next(s for s in state['spaces'] if s['name'] == 'Glyph field')
        tab = space['tabs'][0]
        terminals = tab['terminals']
        if len(terminals) != 2:
            return False
        screens = [c.run(['hc', 'read', t['terminal']]) for t in terminals]
        if any(re.search(r'command not found|Unknown theme|failed to (?:parse|load)|panicked at', screen, re.I) for screen in screens):
            raise RuntimeError('A native fixture failed: ' + '\n'.join(screens))
        return all(any(marker in screen for screen in screens) for marker in (
            'Local source preview', 'Local demo', 'Terminal ANSI palette',
        ))

    wait(c, rendered, 'both live terminal panes and their local output')
    state = json.loads(c.run(['herdr-app', 'status']))
    if state['errors'] or state['overlays']:
        raise RuntimeError(f'Native theme/layout errors or unexpected overlays: {state}')
    assert state['zoom'] == 2, state
    c.run(['xdotool', 'mousemove', '2550', '1590'])
    time.sleep(0.8)  # Final paint after native terminal readiness and window resize.


def cleanup(c):
    # XDG_RUNTIME_DIR and HC_SESSION are disposable; never touch the user's core.
    try:
        c.run(['hc', 'server', 'stop'])
    except (subprocess.CalledProcessError, FileNotFoundError):
        pass
