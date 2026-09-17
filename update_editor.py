import re

filepath = "src/pages/Editor.tsx"

with open(filepath, 'r') as f:
    content = f.read()

# Add state variables
state_vars = """
  const [isConstructorOpen, setIsConstructorOpen] = useState(false);
  const [activeView, setActiveView] = useState<'tree' | 'add-section' | 'add-question'>('tree');
  const [newSectionTitle, setNewSectionTitle] = useState('');
  const [qParentId, setQParentId] = useState<string>('');
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});
  
  // Tree building logic
  const sections = React.useMemo(() => {
    const secMap = new Map<string, any>();
    const pqMap = new Map<string, any>();
    
    paperQuestionsList.forEach(pq => {
      const q = questions.find(x => x.id === pq.questionId);
      pqMap.set(pq.id, { ...pq, text: q?.content, type: q?.questionType, options: q?.options, children: [] });
    });

    paperQuestionsList.forEach(pq => {
      const node = pqMap.get(pq.id);
      if (pq.parentId && pqMap.has(pq.parentId)) {
        pqMap.get(pq.parentId).children.push(node);
      } else {
        if (!secMap.has(pq.section)) {
          secMap.set(pq.section, { id: pq.section, title: pq.section, questions: [] });
        }
        secMap.get(pq.section).questions.push(node);
      }
    });

    return Array.from(secMap.values());
  }, [paperQuestionsList, questions]);

  const totalQuestionsCount = paperQuestionsList.length;

  const getAllQuestionsFlat = (qs: any[], depth = 0): any[] => {
    let result: any[] = [];
    qs.forEach((q) => {
      const prefix = '— '.repeat(depth);
      const text = q.text ? q.text.replace(/<[^>]*>?/gm, '').substring(0, 45) : 'Empty';
      result.push({ id: q.id, label: `${prefix} ${text}...` });
      if (q.children && q.children.length > 0) {
        result = result.concat(getAllQuestionsFlat(q.children, depth + 1));
      }
    });
    return result;
  };

  const selectedSectionObj = sections.find(s => s.id === draftSection);
  const parentCandidates = selectedSectionObj ? getAllQuestionsFlat(selectedSectionObj.questions) : [];

  const toggleExpand = (id: string) => {
    setExpandedNodes(prev => ({ ...prev, [id]: !prev[id] }));
  };
"""

content = content.replace("const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);", 
                          "const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);\n" + state_vars)


# Update handleAddQuestionToSection and handleAddSubQuestion
new_handlers = """
  const handleAddQuestionToSection = (section: string) => {
    setDraftSection(section);
    setIsConstructorOpen(true);
    setActiveView('tree');
  };

  const handleAddSubQuestion = (parentPQ: PaperQuestion) => {
    setDraftSection(parentPQ.section);
    setQParentId(parentPQ.id);
    setIsConstructorOpen(true);
    setActiveView('add-question');
    setDraftType('subjective');
  };
"""

content = re.sub(
    r"const handleAddQuestionToSection = \(section: string\) => \{.*?\};.*?const handleAddSubQuestion = \(parentPQ: PaperQuestion\) => \{.*?\};", 
    new_handlers.strip(), 
    content, 
    flags=re.DOTALL
)

# Update the "Add to Paper" function to use parentId
content = content.replace(
    "await createAndAddQuestion(id, draftContent, draftType as QuestionType, draftType === 'mcq' ? draftOptions : [], draftSection, draftMarks, paper?.courseId, paper?.subjectId, paper?.classId, draftDifficulty, undefined, undefined, draftTypeHeader);",
    "await createAndAddQuestion(id, draftContent, draftType as QuestionType, draftType === 'mcq' ? draftOptions : [], draftSection, qParentId || undefined, draftMarks, paper?.courseId, paper?.subjectId, paper?.classId, draftDifficulty, undefined, undefined, draftTypeHeader);"
)

# Replace the "QUESTION EDITOR MODAL" JSX block entirely
# Need to find it. It starts with `{/* QUESTION EDITOR MODAL */}`
new_modal_jsx = """
      {/* TEST PAPER CONSTRUCTOR MODAL */}
      {isConstructorOpen && (
        <div className="modal-overlay" onClick={() => setIsConstructorOpen(false)}>
          <div className="modal question-editor-modal" style={{ maxWidth: '800px', height: '85vh', display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div>
                <h2 className="modal-title">Test Paper Constructor</h2>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                  Configure sections, questions, and nested subquestions
                </p>
              </div>
              <button className="modal-close-btn" onClick={() => setIsConstructorOpen(false)}>
                <X size={18} />
              </button>
            </div>

            {totalQuestionsCount > 0 && (
              <div style={{ display: 'flex', gap: 10, padding: '10px 20px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', flexShrink: 0 }}>
                <button className={`btn ${activeView === 'tree' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveView('tree')} style={{ padding: '6px 12px', fontSize: 12 }}>
                  <Layers size={14} style={{ marginRight: 6 }}/> Tree View
                </button>
                <button className={`btn ${activeView === 'add-section' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveView('add-section')} style={{ padding: '6px 12px', fontSize: 12 }}>
                  <FolderPlus size={14} style={{ marginRight: 6 }}/> Add Section
                </button>
                <button className={`btn ${activeView === 'add-question' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => {
                  if (sections.length > 0 && !draftSection) setDraftSection(sections[0].id);
                  if (!draftType) setDraftType('subjective');
                  setActiveView('add-question');
                }} style={{ padding: '6px 12px', fontSize: 12 }}>
                  <Plus size={14} style={{ marginRight: 6 }}/> Add Question
                </button>
              </div>
            )}

            <div className="modal-content" style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
              {totalQuestionsCount === 0 && activeView === 'tree' && (
                <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                  <h3 style={{ marginBottom: 10 }}>No questions added yet</h3>
                  <p style={{ color: 'var(--text-secondary)', marginBottom: 30 }}>Get started by adding a section or your first question.</p>
                  <div style={{ display: 'flex', gap: 15, justifyContent: 'center' }}>
                    <button className="btn btn-primary" onClick={() => setActiveView('add-section')} style={{ padding: '15px 25px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                      <FolderPlus size={24} />
                      <span>Add Section</span>
                    </button>
                    <button className="btn btn-primary" onClick={() => {
                      if (sections.length === 0) {
                        setDraftSection('Section A');
                      }
                      setActiveView('add-question');
                      setDraftType('subjective');
                    }} style={{ padding: '15px 25px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                      <Plus size={24} />
                      <span>Add Question</span>
                    </button>
                  </div>
                </div>
              )}

              {activeView === 'tree' && totalQuestionsCount > 0 && (
                <div className="tree-view">
                  {sections.map(sec => (
                    <div key={sec.id} style={{ marginBottom: 20 }}>
                      <h4 style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px', backgroundColor: 'var(--bg-secondary)', borderRadius: 6, marginBottom: 10 }}>
                        <FolderPlus size={16} /> {sec.title}
                        <button className="btn btn-secondary" style={{ marginLeft: 'auto', padding: '4px 8px', fontSize: 12 }} onClick={() => {
                          setDraftSection(sec.id);
                          setQParentId('');
                          setDraftType('subjective');
                          setActiveView('add-question');
                        }}>
                          <Plus size={12} style={{ marginRight: 4 }}/> Add Q
                        </button>
                      </h4>
                      <div>
                        {sec.questions.map((q: any, i: number) => {
                          const renderNode = (node: any, depth: number, idx: number) => {
                            const isExp = expandedNodes[node.id];
                            const hasChildren = node.children && node.children.length > 0;
                            let numLabel = `Q${idx + 1}`;
                            if (depth === 1) numLabel = `(${String.fromCharCode(97 + idx)})`;
                            if (depth === 2) numLabel = `(${['i', 'ii', 'iii', 'iv', 'v'][idx] || idx + 1})`;
                            if (depth >= 3) numLabel = `•`;

                            return (
                              <div key={node.id} style={{ marginLeft: depth > 0 ? 20 : 0, marginTop: 10 }}>
                                <div style={{ display: 'flex', gap: 10, padding: '10px', border: '1px solid var(--border-color)', borderRadius: 6, backgroundColor: 'var(--bg-primary)' }}>
                                  <button onClick={() => toggleExpand(node.id)} style={{ background: 'none', border: 'none', cursor: hasChildren ? 'pointer' : 'default', opacity: hasChildren ? 1 : 0.3 }}>
                                    {hasChildren ? (isExp ? <ChevronDown size={14}/> : <ChevronRight size={14}/>) : <span style={{display: 'inline-block', width: 14}}/>}
                                  </button>
                                  <span style={{ fontWeight: 'bold', minWidth: 30 }}>{numLabel}</span>
                                  <div style={{ flex: 1 }}>
                                    <div dangerouslySetInnerHTML={{ __html: node.text }} />
                                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
                                      [{node.marks} marks] | {node.type}
                                    </div>
                                  </div>
                                  <div style={{ display: 'flex', gap: 5 }}>
                                    <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => {
                                      setDraftSection(sec.id);
                                      setQParentId(node.id);
                                      setDraftType('subjective');
                                      setActiveView('add-question');
                                    }}>+ Sub</button>
                                    <button className="hover-action-btn danger" style={{ padding: 4 }} onClick={() => handleRemovePQ(node.id, node.questionId)}>
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </div>
                                {hasChildren && isExp && (
                                  <div style={{ borderLeft: '2px dashed var(--border-color)', marginLeft: 15, paddingLeft: 5 }}>
                                    {node.children.map((child: any, cidx: number) => renderNode(child, depth + 1, cidx))}
                                  </div>
                                )}
                              </div>
                            );
                          };
                          return renderNode(q, 0, i);
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeView === 'add-section' && (
                <div style={{ maxWidth: 500, margin: '0 auto', padding: '20px', border: '1px solid var(--border-color)', borderRadius: 8 }}>
                  <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                    <FolderPlus size={18} /> Add New Section
                  </h3>
                  <div className="property-field">
                    <label className="property-label">Section Title</label>
                    <input 
                      type="text" 
                      className="property-input" 
                      placeholder="e.g., Section A: Objective Type"
                      value={newSectionTitle}
                      onChange={(e) => setNewSectionTitle(e.target.value)}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
                    {totalQuestionsCount > 0 && <button className="btn btn-secondary" onClick={() => setActiveView('tree')}>Cancel</button>}
                    <button className="btn btn-primary" onClick={() => {
                      if (!newSectionTitle.trim()) return;
                      // Just set draftSection to new title, it will be added when a question is added
                      setDraftSection(newSectionTitle);
                      setNewSectionTitle('');
                      setQParentId('');
                      setDraftType('subjective');
                      setActiveView('add-question');
                    }}>Continue to Add Questions</button>
                  </div>
                </div>
              )}

              {activeView === 'add-question' && draftType && (
                <div style={{ maxWidth: 700, margin: '0 auto' }}>
                  <div style={{ display: 'flex', gap: 12, marginBottom: 15 }}>
                    <div className="property-field" style={{ flex: 1 }}>
                      <label className="property-label">Target Section</label>
                      <select className="property-input" value={draftSection} onChange={(e) => { setDraftSection(e.target.value); setQParentId(''); }}>
                        {sections.length > 0 ? sections.map(s => <option key={s.id} value={s.id}>{s.title}</option>) : <option value={draftSection}>{draftSection}</option>}
                      </select>
                    </div>
                    <div className="property-field" style={{ flex: 1 }}>
                      <label className="property-label">Parent Question (Optional)</label>
                      <select className="property-input" value={qParentId} onChange={(e) => setQParentId(e.target.value)}>
                        <option value="">-- Top Level --</option>
                        {parentCandidates.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 12, marginBottom: 15 }}>
                    <div className="property-field" style={{ flex: 1 }}>
                      <label className="property-label">Question Type</label>
                      <select className="property-input" value={draftType} onChange={(e) => setDraftType(e.target.value as any)}>
                        <option value="subjective">Subjective</option>
                        <option value="mcq">Multiple Choice</option>
                        <option value="truefalse">True / False</option>
                        <option value="fillblank">Fill in Blank</option>
                      </select>
                    </div>
                    <div className="property-field" style={{ flex: 1 }}>
                      <label className="property-label">Marks</label>
                      <input type="number" className="property-input" value={draftMarks} onChange={(e) => setDraftMarks(parseInt(e.target.value) || 1)} min={1} />
                    </div>
                    <div className="property-field" style={{ flex: 1 }}>
                      <label className="property-label">Difficulty</label>
                      <select className="property-input" value={draftDifficulty} onChange={(e) => setDraftDifficulty(e.target.value as Difficulty)}>
                        <option value="easy">Easy</option>
                        <option value="medium">Medium</option>
                        <option value="hard">Hard</option>
                      </select>
                    </div>
                  </div>

                  <div className="property-field" style={{ marginBottom: 15 }}>
                    <label className="property-label">Question Content</label>
                    <FullQuill value={draftContent} onChange={setDraftContent} placeholder="Enter your question..." openMathDialog={openMathDialog} toolbarId="question-toolbar" />
                  </div>

                  {draftType === 'mcq' && (
                    <div className="property-field" style={{ marginBottom: 15 }}>
                      <label className="property-label">Options</label>
                      {draftOptions.map((opt, i) => (
                        <div key={i} style={{ marginBottom: 12 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                            <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Option {String.fromCharCode(65 + i)}</label>
                            {draftOptions.length > 2 && (
                              <button className="hover-action-btn danger" onClick={() => handleRemoveOption(i)} style={{ padding: '2px 4px' }}>
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                          <FullQuill value={opt} onChange={(val) => { const newOpts = [...draftOptions]; newOpts[i] = val; setDraftOptions(newOpts); }} placeholder={`Option ${String.fromCharCode(65 + i)}`} openMathDialog={openMathDialog} toolbarId={`option-toolbar-${i}`} />
                        </div>
                      ))}
                      <button className="btn btn-secondary" onClick={handleAddOption} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 4 }}>
                        <Plus size={14} /> Add Option
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {activeView === 'add-question' && (
              <div className="modal-actions" style={{ padding: '15px 20px', borderTop: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', flexShrink: 0 }}>
                {totalQuestionsCount > 0 && <button className="btn btn-secondary" onClick={() => setActiveView('tree')}>Cancel</button>}
                <button className="btn btn-primary" onClick={handleAddDraftToPaper} disabled={saving || !draftContent.trim()}>
                  {saving ? 'Adding...' : (editingQuestionId ? 'Update Question' : 'Add Question')}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
"""

# Replace the modal block
start_tag = "{/* QUESTION EDITOR MODAL */}"
end_tag = "{/* PAPER SETTINGS MODAL */}"

start_idx = content.find(start_tag)
end_idx = content.find(end_tag)

if start_idx != -1 and end_idx != -1:
    content = content[:start_idx] + new_modal_jsx + "\n      " + content[end_idx:]

with open(filepath, 'w') as f:
    f.write(content)

print("Updated Editor.tsx")
