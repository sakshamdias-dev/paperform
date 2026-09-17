import React, { useState } from 'react';
import { 
  PlusCircle, 
  ChevronRight, 
  ChevronDown, 
  FileText, 
  Trash2, 
  HelpCircle, 
  FolderPlus, 
  CheckSquare, 
  AlignLeft, 
  Printer, 
  Sparkles,
  X,
  Layers,
  ArrowRight,
  ListOrdered
} from 'lucide-react';

export default function App() {
  // Modal & View States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeView, setActiveView] = useState('tree'); // 'tree', 'add-section', 'add-question'
  const [previewMode, setPreviewMode] = useState(false);

  // Form States
  const [paperTitle, setPaperTitle] = useState('Mid-Term Mathematics & Science Examination');
  const [newSectionTitle, setNewSectionTitle] = useState('');
  
  // Question Form State
  const [qSectionId, setQSectionId] = useState('');
  const [qParentId, setQParentId] = useState(''); // Empty string means top-level question
  const [qText, setQText] = useState('');
  const [qType, setQType] = useState('mcq'); // 'mcq' or 'subjective'
  const [qMarks, setQMarks] = useState(5);
  const [qOptions, setQOptions] = useState(['Option A', 'Option B', 'Option C', 'Option D']);

  // Pre-loaded dummy dataset with sections and multi-level subquestions
  const [sections, setSections] = useState([
    {
      id: 'sec-1',
      title: 'Section A: Physics & Mathematics (Multiple Choice)',
      questions: [
        {
          id: 'q-1',
          text: 'Which of the following equations represents Newton\'s Second Law of Motion?',
          type: 'mcq',
          marks: 2,
          options: ['F = m / a', 'F = m * a', 'F = m + a', 'E = mc^2'],
          children: []
        },
        {
          id: 'q-2',
          text: 'Consider a particle moving in a straight line with uniform acceleration.',
          type: 'subjective',
          marks: 8,
          options: [],
          children: [
            {
              id: 'q-2-1',
              text: 'Derive the formula v = u + at from first principles.',
              type: 'subjective',
              marks: 3,
              options: [],
              children: []
            },
            {
              id: 'q-2-2',
              text: 'A car starts from rest and accelerates at 2 m/s² for 5 seconds.',
              type: 'subjective',
              marks: 5,
              options: [],
              children: [
                {
                  id: 'q-2-2-1',
                  text: 'Calculate its final velocity.',
                  type: 'subjective',
                  marks: 2,
                  options: [],
                  children: []
                },
                {
                  id: 'q-2-2-2',
                  text: 'Calculate the total distance traveled during this duration.',
                  type: 'subjective',
                  marks: 3,
                  options: [],
                  children: []
                }
              ]
            }
          ]
        }
      ]
    },
    {
      id: 'sec-2',
      title: 'Section B: Advanced Biology & Analysis',
      questions: [
        {
          id: 'q-3',
          text: 'Explain the fundamental mechanisms of Cellular Respiration.',
          type: 'subjective',
          marks: 10,
          options: [],
          children: [
            {
              id: 'q-3-1',
              text: 'Differentiate between aerobic and anaerobic respiration in detail.',
              type: 'subjective',
              marks: 4,
              options: [],
              children: []
            },
            {
              id: 'q-3-2',
              text: 'Where does glycolysis take place within a eukaryotic cell?',
              type: 'mcq',
              marks: 2,
              options: ['Mitochondria Matrix', 'Cytoplasm', 'Nucleus', 'Endoplasmic Reticulum'],
              children: []
            }
          ]
        }
      ]
    }
  ]);

  // Tree Expansion Toggle State
  const [expandedNodes, setExpandedNodes] = useState({
    'sec-1': true,
    'sec-2': true,
    'q-2': true,
    'q-2-2': true,
    'q-3': true
  });

  const toggleExpand = (id) => {
    setExpandedNodes((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Clear all data to simulate fresh state
  const handleClearAll = () => {
    setSections([]);
    setActiveView('tree');
  };

  // Handlers for dynamic section creation
  const handleAddSection = (e) => {
    e.preventDefault();
    if (!newSectionTitle.trim()) return;
    const newSec = {
      id: `sec-${Date.now()}`,
      title: newSectionTitle,
      questions: []
    };
    setSections([...sections, newSec]);
    setExpandedNodes(prev => ({ ...prev, [newSec.id]: true }));
    setNewSectionTitle('');
    setActiveView('tree');
  };

  // Recursive Helper to Insert Subquestion at correct node
  const insertQuestionRecursive = (questionList, parentId, newQ) => {
    return questionList.map((q) => {
      if (q.id === parentId) {
        return { ...q, children: [...q.children, newQ] };
      }
      if (q.children && q.children.length > 0) {
        return {
          ...q,
          children: insertQuestionRecursive(q.children, parentId, newQ)
        };
      }
      return q;
    });
  };

  const handleAddQuestion = (e) => {
    e.preventDefault();
    if (!qText.trim() || !qSectionId) return;

    const newQ = {
      id: `q-${Date.now()}`,
      text: qText,
      type: qType,
      marks: Number(qMarks),
      options: qType === 'mcq' ? qOptions.filter(o => o.trim() !== '') : [],
      children: []
    };

    setSections(prevSections => {
      return prevSections.map(sec => {
        if (sec.id === qSectionId) {
          if (!qParentId) {
            // Direct child of section
            return { ...sec, questions: [...sec.questions, newQ] };
          } else {
            // Subquestion under another question
            return {
              ...sec,
              questions: insertQuestionRecursive(sec.questions, qParentId, newQ)
            };
          }
        }
        return sec;
      });
    });

    // Expand parent nodes so the newly added question is visible
    if (qParentId) setExpandedNodes(prev => ({ ...prev, [qParentId]: true }));
    setExpandedNodes(prev => ({ ...prev, [qSectionId]: true }));

    // Reset Form
    setQText('');
    setQParentId('');
    setActiveView('tree');
  };

  // Helper to flatten questions for Parent Dropdown selection
  const getAllQuestionsFlat = (questions, depth = 0) => {
    let result = [];
    questions.forEach((q) => {
      const prefix = '— '.repeat(depth);
      result.push({ id: q.id, label: `${prefix} ${q.text.substring(0, 45)}...` });
      if (q.children && q.children.length > 0) {
        result = result.concat(getAllQuestionsFlat(q.children, depth + 1));
      }
    });
    return result;
  };

  // Get current section's question tree options for subquestion dropdown
  const selectedSectionObj = sections.find(s => s.id === qSectionId);
  const parentCandidates = selectedSectionObj 
    ? getAllQuestionsFlat(selectedSectionObj.questions)
    : [];

  // Delete Question Helper
  const deleteQuestionRecursive = (questions, id) => {
    return questions
      .filter(q => q.id !== id)
      .map(q => ({
        ...q,
        children: deleteQuestionRecursive(q.children, id)
      }));
  };

  const handleDeleteQuestion = (sectionId, qId) => {
    setSections(sections.map(sec => {
      if (sec.id === sectionId) {
        return {
          ...sec,
          questions: deleteQuestionRecursive(sec.questions, qId)
        };
      }
      return sec;
    }));
  };

  const handleDeleteSection = (sectionId) => {
    setSections(sections.filter(s => s.id !== sectionId));
  };

  // Total questions counter across all sections & nesting levels
  const countAllQuestions = (qs) => {
    return qs.reduce((acc, q) => acc + 1 + countAllQuestions(q.children || []), 0);
  };
  const totalQuestionsCount = sections.reduce((acc, sec) => acc + countAllQuestions(sec.questions), 0);

  // Renderer for Tree Item in Modal
  const renderTreeQuestionNode = (question, sectionId, depth = 0, index = 0) => {
    const isExpanded = expandedNodes[question.id];
    const hasChildren = question.children && question.children.length > 0;
    
    // Label Prefix calculations (e.g. Q1, (a), (i))
    let numberLabel = `Q${index + 1}`;
    if (depth === 1) numberLabel = `(${String.fromCharCode(97 + index)})`;
    if (depth === 2) numberLabel = `(${['i', 'ii', 'iii', 'iv', 'v'][index] || index + 1})`;
    if (depth >= 3) numberLabel = `•`;

    return (
      <div key={question.id} className="ml-3 md:ml-6 mt-2">
        <div className="flex items-start gap-2 group p-2.5 rounded-lg bg-white border border-slate-200 hover:border-indigo-300 transition-all shadow-sm">
          {/* Expand Toggle */}
          <button
            onClick={() => toggleExpand(question.id)}
            className={`p-1 mt-0.5 rounded hover:bg-slate-100 text-slate-500 ${!hasChildren ? 'opacity-20 cursor-default' : ''}`}
            disabled={!hasChildren}
          >
            {hasChildren ? (
              isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />
            ) : (
              <span className="w-4 h-4 inline-block" />
            )}
          </button>

          {/* Number Tag */}
          <span className="font-bold text-slate-700 min-w-[28px] text-sm mt-0.5">
            {numberLabel}
          </span>

          {/* Question Main Content */}
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-slate-800 text-sm font-medium">{question.text}</span>
              
              {/* Type Badge */}
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                question.type === 'mcq' 
                  ? 'bg-blue-50 text-blue-600 border border-blue-200' 
                  : 'bg-emerald-50 text-emerald-600 border border-emerald-200'
              }`}>
                {question.type === 'mcq' ? 'MCQ' : 'Subjective'}
              </span>

              {/* Marks Tag */}
              <span className="text-xs text-slate-400 font-normal">
                [{question.marks} {question.marks === 1 ? 'mark' : 'marks'}]
              </span>
            </div>

            {/* MCQ Options Display */}
            {question.type === 'mcq' && question.options.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-2 pl-2 border-l-2 border-slate-100">
                {question.options.map((opt, idx) => (
                  <div key={idx} className="text-xs text-slate-600 flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-[10px] font-medium">
                      {String.fromCharCode(65 + idx)}
                    </span>
                    <span>{opt}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
            <button
              onClick={() => {
                setQSectionId(sectionId);
                setQParentId(question.id);
                setActiveView('add-question');
              }}
              title="Add Subquestion"
              className="px-2 py-1 text-xs bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded font-medium transition-colors flex items-center gap-1"
            >
              <PlusCircle size={13} />
              <span className="hidden sm:inline">Add Sub</span>
            </button>

            <button
              onClick={() => handleDeleteQuestion(sectionId, question.id)}
              className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
              title="Delete Question"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        {/* Recursive Children Render */}
        {hasChildren && isExpanded && (
          <div className="border-l-2 border-dashed border-indigo-100 pl-2">
            {question.children.map((child, idx) =>
              renderTreeQuestionNode(child, sectionId, depth + 1, idx)
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans">
      {/* Header Bar */}
      <header className="bg-slate-800 border-b border-slate-700 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 sticky top-0 z-10 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600 rounded-lg text-white shadow-md">
            <FileText size={22} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight">Test Paper Builder Blueprint</h1>
            <p className="text-xs text-slate-400">Interactive Demo for Developer Integration</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setActiveView('tree');
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-lg font-medium text-sm transition-all shadow-md shadow-indigo-600/30 hover:scale-[1.02] active:scale-[0.98]"
          >
            <Sparkles size={18} />
            <span>Create Test Paper</span>
          </button>
        </div>
      </header>

      {/* Main Landing Page */}
      <main className="flex-1 p-6 max-w-5xl mx-auto w-full flex flex-col justify-center">
        {/* Hero Card */}
        <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-8 mb-8 text-center backdrop-blur-sm shadow-xl">
          <div className="inline-flex p-3 bg-indigo-500/10 text-indigo-400 rounded-2xl mb-4 border border-indigo-500/20">
            <Layers size={32} />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Test Paper Constructor Integration</h2>
          <p className="text-slate-400 max-w-xl mx-auto text-sm leading-relaxed mb-6">
            Click <strong className="text-indigo-400">"Create Test Paper"</strong> to open the builder modal. If no questions exist, you'll be greeted with two big option buttons: <strong className="text-indigo-300">(a) Add Section</strong> and <strong className="text-indigo-300">(b) Add Question</strong>.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => {
                setActiveView('tree');
                setIsModalOpen(true);
              }}
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-xl font-semibold text-sm transition-all shadow-lg shadow-indigo-600/20"
            >
              <PlusCircle size={18} />
              Open Builder Modal
            </button>

            {sections.length > 0 && (
              <button
                onClick={handleClearAll}
                className="inline-flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-slate-300 px-4 py-3 rounded-xl font-medium text-xs transition-all"
              >
                <Trash2 size={15} />
                Clear All Questions (Test Empty State)
              </button>
            )}
          </div>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-800/40 border border-slate-700/50 p-5 rounded-xl">
            <div className="text-indigo-400 font-semibold text-sm mb-1 flex items-center gap-2">
              <FolderPlus size={16} /> (a) Add Section Button
            </div>
            <p className="text-xs text-slate-400 leading-normal">
              Direct button action to introduce new major paper divisions or subject categories.
            </p>
          </div>

          <div className="bg-slate-800/40 border border-slate-700/50 p-5 rounded-xl">
            <div className="text-emerald-400 font-semibold text-sm mb-1 flex items-center gap-2">
              <HelpCircle size={16} /> (b) Add Question Button
            </div>
            <p className="text-xs text-slate-400 leading-normal">
              Adds Subjective or MCQ questions with subquestion nesting support.
            </p>
          </div>

          <div className="bg-slate-800/40 border border-slate-700/50 p-5 rounded-xl">
            <div className="text-blue-400 font-semibold text-sm mb-1 flex items-center gap-2">
              <ListOrdered size={16} /> Expandable Tree
            </div>
            <p className="text-xs text-slate-400 leading-normal">
              Hierarchical view rendered sequentially with arrow expansion controls.
            </p>
          </div>
        </div>
      </main>

      {/* ================= BUILDER MODAL ================= */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-800/80 border-b border-slate-700/70 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <FileText className="text-indigo-400" size={18} />
                  Test Paper Constructor
                </h3>
                <p className="text-xs text-slate-400">Configure sections, questions, and nested subquestions</p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Action Bar (When questions exist) */}
            {totalQuestionsCount > 0 && (
              <div className="bg-slate-800/40 border-b border-slate-800 px-6 py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveView('tree')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                      activeView === 'tree'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    <Layers size={14} /> Tree View ({totalQuestionsCount})
                  </button>
                </div>

                {/* Main Option Buttons */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveView('add-section')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 border ${
                      activeView === 'add-section'
                        ? 'bg-indigo-600 border-indigo-500 text-white'
                        : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
                    }`}
                  >
                    <FolderPlus size={14} /> (a) Add Section
                  </button>

                  <button
                    onClick={() => {
                      if (sections.length > 0 && !qSectionId) {
                        setQSectionId(sections[0].id);
                      }
                      setActiveView('add-question');
                    }}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 border ${
                      activeView === 'add-question'
                        ? 'bg-indigo-600 border-indigo-500 text-white'
                        : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
                    }`}
                  >
                    <PlusCircle size={14} /> (b) Add Question
                  </button>
                </div>
              </div>
            )}

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 bg-slate-900">
              
              {/* ================= 1. EMPTY STATE WITH TWO BIG BUTTONS ================= */}
              {totalQuestionsCount === 0 && activeView === 'tree' && (
                <div className="py-8 px-4 text-center max-w-2xl mx-auto space-y-6">
                  <div className="space-y-2">
                    <h4 className="text-xl font-bold text-white">No questions added to this test paper yet</h4>
                    <p className="text-xs text-slate-400">
                      Get started by choosing one of the two options below to begin structuring your exam.
                    </p>
                  </div>

                  {/* Two Prominent Action Option Buttons */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
                    <button
                      onClick={() => setActiveView('add-section')}
                      className="group bg-slate-800/80 hover:bg-indigo-950/40 border-2 border-dashed border-indigo-500/40 hover:border-indigo-500 p-6 rounded-2xl flex flex-col items-center text-center transition-all shadow-md hover:shadow-indigo-500/10 cursor-pointer"
                    >
                      <div className="p-4 bg-indigo-600/10 text-indigo-400 rounded-2xl mb-3 group-hover:scale-110 transition-transform">
                        <FolderPlus size={28} />
                      </div>
                      <span className="text-sm font-bold text-white mb-1 flex items-center gap-1">
                        (a) Add Section
                        <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                      </span>
                      <span className="text-xs text-slate-400 leading-relaxed">
                        Create high-level sections like "Section A: MCQs" or "Section B: Long Answers".
                      </span>
                    </button>

                    <button
                      onClick={() => {
                        if (sections.length === 0) {
                          // Auto-create a default section if user chooses Add Question directly
                          const defaultSec = {
                            id: `sec-${Date.now()}`,
                            title: 'General Section',
                            questions: []
                          };
                          setSections([defaultSec]);
                          setQSectionId(defaultSec.id);
                        } else if (!qSectionId) {
                          setQSectionId(sections[0].id);
                        }
                        setActiveView('add-question');
                      }}
                      className="group bg-slate-800/80 hover:bg-emerald-950/40 border-2 border-dashed border-emerald-500/40 hover:border-emerald-500 p-6 rounded-2xl flex flex-col items-center text-center transition-all shadow-md hover:shadow-emerald-500/10 cursor-pointer"
                    >
                      <div className="p-4 bg-emerald-600/10 text-emerald-400 rounded-2xl mb-3 group-hover:scale-110 transition-transform">
                        <PlusCircle size={28} />
                      </div>
                      <span className="text-sm font-bold text-white mb-1 flex items-center gap-1">
                        (b) Add Question
                        <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                      </span>
                      <span className="text-xs text-slate-400 leading-relaxed">
                        Add Subjective or Multiple Choice questions and build subquestions directly.
                      </span>
                    </button>
                  </div>
                </div>
              )}

              {/* ================= 2. VIEW: ADD SECTION FORM ================= */}
              {activeView === 'add-section' && (
                <form onSubmit={handleAddSection} className="max-w-xl mx-auto space-y-5 py-4">
                  <div className="bg-slate-800/50 border border-slate-700/80 p-6 rounded-xl space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        <FolderPlus className="text-indigo-400" size={18} />
                        (a) Add Section
                      </h4>
                      {totalQuestionsCount > 0 && (
                        <button
                          type="button"
                          onClick={() => setActiveView('tree')}
                          className="text-xs text-slate-400 hover:text-white"
                        >
                          Cancel
                        </button>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Section Name / Title *
                      </label>
                      <input
                        type="text"
                        placeholder="e.g., Section A: Physics Multiple Choice Questions"
                        value={newSectionTitle}
                        onChange={(e) => setNewSectionTitle(e.target.value)}
                        required
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div className="pt-2 flex justify-end gap-2">
                      <button
                        type="submit"
                        className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 shadow-md"
                      >
                        <PlusCircle size={14} />
                        Save Section
                      </button>
                    </div>
                  </div>
                </form>
              )}

              {/* ================= 3. VIEW: ADD QUESTION FORM ================= */}
              {activeView === 'add-question' && (
                <form onSubmit={handleAddQuestion} className="max-w-2xl mx-auto space-y-4 py-2">
                  <div className="bg-slate-800/50 border border-slate-700/80 p-6 rounded-xl space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-700/60 pb-3">
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        <PlusCircle className="text-emerald-400" size={18} />
                        (b) Add Question (Subjective or Multiple Choice)
                      </h4>
                      {totalQuestionsCount > 0 && (
                        <button
                          type="button"
                          onClick={() => setActiveView('tree')}
                          className="text-xs text-slate-400 hover:text-white"
                        >
                          Cancel
                        </button>
                      )}
                    </div>

                    {sections.length === 0 ? (
                      <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-xl text-center text-amber-300 text-xs">
                        No sections available. Please add a <strong>Section</strong> first.
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Target Section */}
                          <div>
                            <label className="block text-xs font-medium text-slate-300 mb-1">
                              Select Section *
                            </label>
                            <select
                              value={qSectionId}
                              onChange={(e) => {
                                setQSectionId(e.target.value);
                                setQParentId(''); // reset parent selection when section changes
                              }}
                              required
                              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                            >
                              {sections.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.title}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Parent Question for Nesting */}
                          <div>
                            <label className="block text-xs font-medium text-slate-300 mb-1">
                              Parent Question (To Add as Subquestion)
                            </label>
                            <select
                              value={qParentId}
                              onChange={(e) => setQParentId(e.target.value)}
                              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                            >
                              <option value="">-- Main Level Question (Top) --</option>
                              {parentCandidates.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* Question Type & Marks */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-medium text-slate-300 mb-1">
                              Question Type *
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={() => setQType('mcq')}
                                className={`py-2 px-3 rounded-lg text-xs font-medium border flex items-center justify-center gap-1.5 transition-all ${
                                  qType === 'mcq'
                                    ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300 font-bold'
                                    : 'bg-slate-950 border-slate-700 text-slate-400 hover:text-slate-200'
                                }`}
                              >
                                <CheckSquare size={14} /> Multiple Choice
                              </button>
                              <button
                                type="button"
                                onClick={() => setQType('subjective')}
                                className={`py-2 px-3 rounded-lg text-xs font-medium border flex items-center justify-center gap-1.5 transition-all ${
                                  qType === 'subjective'
                                    ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300 font-bold'
                                    : 'bg-slate-950 border-slate-700 text-slate-400 hover:text-slate-200'
                                }`}
                              >
                                <AlignLeft size={14} /> Subjective
                              </button>
                            </div>
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-slate-300 mb-1">
                              Marks Allocated
                            </label>
                            <input
                              type="number"
                              min="1"
                              max="100"
                              value={qMarks}
                              onChange={(e) => setQMarks(e.target.value)}
                              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                            />
                          </div>
                        </div>

                        {/* Question Text */}
                        <div>
                          <label className="block text-xs font-medium text-slate-300 mb-1">
                            Question Prompt *
                          </label>
                          <textarea
                            rows={3}
                            placeholder="Type your question text here..."
                            value={qText}
                            onChange={(e) => setQText(e.target.value)}
                            required
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                          />
                        </div>

                        {/* MCQ Dynamic Options */}
                        {qType === 'mcq' && (
                          <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-xl space-y-2">
                            <label className="block text-xs font-medium text-indigo-300">
                              Multiple Choice Options
                            </label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {qOptions.map((opt, idx) => (
                                <div key={idx} className="flex items-center gap-2">
                                  <span className="w-5 text-center text-xs font-bold text-slate-400">
                                    {String.fromCharCode(65 + idx)}.
                                  </span>
                                  <input
                                    type="text"
                                    value={opt}
                                    onChange={(e) => {
                                      const updated = [...qOptions];
                                      updated[idx] = e.target.value;
                                      setQOptions(updated);
                                    }}
                                    className="flex-1 bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                                    placeholder={`Option ${idx + 1}`}
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="flex justify-end pt-2">
                          <button
                            type="submit"
                            className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-lg text-xs font-semibold transition-all shadow-md flex items-center gap-1.5"
                          >
                            <PlusCircle size={14} /> Add Question to Tree
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </form>
              )}

              {/* ================= 4. VIEW: SEQUENTIAL TREE STRUCTURE ================= */}
              {activeView === 'tree' && totalQuestionsCount > 0 && (
                <div className="space-y-4">
                  {sections.map((section) => {
                    const isSecExpanded = expandedNodes[section.id];
                    return (
                      <div key={section.id} className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
                        {/* Section Header */}
                        <div className="bg-slate-800/60 p-3.5 flex items-center justify-between border-b border-slate-800">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => toggleExpand(section.id)}
                              className="p-1 text-slate-400 hover:text-white rounded"
                            >
                              {isSecExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            </button>
                            <span className="font-bold text-xs md:text-sm text-indigo-300">
                              {section.title}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                setQSectionId(section.id);
                                setQParentId('');
                                setActiveView('add-question');
                              }}
                              className="text-[11px] font-medium bg-slate-700 hover:bg-slate-600 text-slate-200 px-2.5 py-1 rounded flex items-center gap-1 transition-colors"
                            >
                              <PlusCircle size={12} /> Add Main Q
                            </button>

                            <button
                              onClick={() => handleDeleteSection(section.id)}
                              className="p-1 text-slate-500 hover:text-red-400 rounded transition-colors"
                              title="Delete Section"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>

                        {/* Section Questions Sequential Tree */}
                        {isSecExpanded && (
                          <div className="p-3">
                            {section.questions.length === 0 ? (
                              <p className="text-xs text-slate-500 italic py-2 pl-6">
                                No questions under this section yet.
                              </p>
                            ) : (
                              section.questions.map((q, idx) =>
                                renderTreeQuestionNode(q, section.id, 0, idx)
                              )
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-slate-800/80 border-t border-slate-700/70 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-xs text-slate-400 flex items-center gap-3">
                <span>Sections: <strong className="text-white">{sections.length}</strong></span>
                <span>Total Questions: <strong className="text-white">{totalQuestionsCount}</strong></span>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                >
                  Close
                </button>

                <button
                  onClick={() => {
                    setPreviewMode(true);
                    setIsModalOpen(false);
                  }}
                  disabled={totalQuestionsCount === 0}
                  className={`w-full sm:w-auto px-5 py-2 rounded-lg font-bold text-xs transition-all shadow-md flex items-center justify-center gap-2 ${
                    totalQuestionsCount === 0
                      ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  }`}
                >
                  <Printer size={15} />
                  Generate Paper
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ================= GENERATED PAPER VIEW MODAL ================= */}
      {previewMode && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white text-slate-900 rounded-2xl w-full max-w-4xl p-8 sm:p-12 shadow-2xl relative my-8">
            {/* Control Header */}
            <div className="absolute top-4 right-4 flex items-center gap-2 print:hidden">
              <button
                onClick={() => window.print()}
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow"
              >
                <Printer size={14} /> Print Paper
              </button>
              <button
                onClick={() => setPreviewMode(false)}
                className="bg-slate-200 hover:bg-slate-300 text-slate-700 p-1.5 rounded-lg text-xs"
              >
                <X size={16} />
              </button>
            </div>

            {/* Exam Header */}
            <div className="text-center border-b-2 border-slate-900 pb-6 mb-8">
              <h1 className="text-2xl font-extrabold uppercase tracking-wide">{paperTitle}</h1>
              <div className="flex justify-between items-center text-xs font-semibold text-slate-600 mt-4 px-2">
                <span>Time Allowed: 3 Hours</span>
                <span>Maximum Marks: 100</span>
              </div>
            </div>

            {/* Rendered Questions */}
            <div className="space-y-8">
              {sections.map((section) => (
                <div key={section.id} className="space-y-4">
                  <h3 className="font-bold text-base bg-slate-100 p-2 border-l-4 border-slate-800">
                    {section.title}
                  </h3>

                  <div className="space-y-4 pl-2">
                    {section.questions.map((q, idx) => (
                      <PaperQuestionRender key={q.id} question={q} depth={0} index={idx} />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Exam Footer */}
            <div className="mt-12 text-center text-xs font-bold text-slate-400 border-t pt-4">
              *** END OF EXAMINATION PAPER ***
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Subcomponent to render paper questions recursively in generated preview
function PaperQuestionRender({ question, depth = 0, index = 0 }) {
  let label = `Q${index + 1}.`;
  if (depth === 1) label = `(${String.fromCharCode(97 + index)})`;
  if (depth === 2) label = `(${['i', 'ii', 'iii', 'iv', 'v'][index] || index + 1})`;

  return (
    <div className={`space-y-2 ${depth > 0 ? 'ml-6 mt-2' : 'mt-3'}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-2 text-sm">
          <span className="font-bold text-slate-800 min-w-[24px]">{label}</span>
          <span className="text-slate-900">{question.text}</span>
        </div>
        <span className="text-xs font-semibold text-slate-600 whitespace-nowrap">
          [{question.marks}]
        </span>
      </div>

      {/* Options for MCQ */}
      {question.type === 'mcq' && question.options.length > 0 && (
        <div className="grid grid-cols-2 gap-2 pl-8 text-xs text-slate-800 my-2">
          {question.options.map((opt, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span className="font-semibold">({String.fromCharCode(65 + i)})</span>
              <span>{opt}</span>
            </div>
          ))}
        </div>
      )}

      {/* Sub-questions recursive rendering */}
      {question.children && question.children.length > 0 && (
        <div className="space-y-2">
          {question.children.map((child, i) => (
            <PaperQuestionRender key={child.id} question={child} depth={depth + 1} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}