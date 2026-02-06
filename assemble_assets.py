import os

# Paths
base_dir = "VoiceTmuxApp/Sources/XTerminalUI"
resources_dir = os.path.join(base_dir, "Resources")
target_file = os.path.join(base_dir, "TerminalScript.swift")

# Read resources
def read_resource(filename):
    path = os.path.join(resources_dir, filename)
    with open(path, "r", encoding="utf-8") as f:
        return f.read()

xterm_css = read_resource("xterm.css")
xterm_js = read_resource("xterm.min.js")
fit_js = read_resource("xterm-addon-fit.min.js")

# Read target file
with open(target_file, "r", encoding="utf-8") as f:
    content = f.read()

# Replace placeholders
# We do naive replace.
content = content.replace("/*XTERMCSS_PLACEHOLDER*/", xterm_css)
content = content.replace("/*XTERMJS_PLACEHOLDER*/", xterm_js)
content = content.replace("/*FITADDON_PLACEHOLDER*/", fit_js)

# Write back
with open(target_file, "w", encoding="utf-8") as f:
    f.write(content)

print(f"Successfully inlined resources into {target_file}")
