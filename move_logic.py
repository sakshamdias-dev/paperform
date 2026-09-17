import sys

filepath = "src/pages/Editor.tsx"

with open(filepath, 'r') as f:
    lines = f.readlines()

start_idx = -1
end_idx = -1
insert_idx = -1

for i, line in enumerate(lines):
    if "// Tree building logic" in line:
        start_idx = i
    if "setExpandedNodes(prev => ({ ...prev, [id]: !prev[id] }));" in line:
        end_idx = i + 2 # include the closing brace and newline
    if "}, [paperQuestions, id]);" in line and "const paperQuestionsList = useMemo(() => {" in "".join(lines[max(0, i-2):i]):
        insert_idx = i + 1

if start_idx != -1 and end_idx != -1 and insert_idx != -1:
    extracted = lines[start_idx:end_idx]
    # Remove from original location
    del lines[start_idx:end_idx]
    
    # Recalculate insert index since lines shifted
    if insert_idx > start_idx:
        insert_idx -= (end_idx - start_idx)
        
    lines = lines[:insert_idx] + ["\n"] + extracted + ["\n"] + lines[insert_idx:]
    
    with open(filepath, 'w') as f:
        f.writelines(lines)
    print("Successfully moved tree logic.")
else:
    print(f"Failed to find boundaries. Start: {start_idx}, End: {end_idx}, Insert: {insert_idx}")
