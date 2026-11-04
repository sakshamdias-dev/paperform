import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { Table2, ImageIcon } from 'lucide-react';
import { cleanImageHtml, latexToQuillFormula } from '../utils/mathjax';
import MathLiveDialog from './MathLiveDialog';

export const CustomToolbar = ({ id = "toolbar" }: { id?: string }) => (
  <div id={id}>
    <span className="ql-formats">
      <button className="ql-bold" title="Bold" />
      <button className="ql-italic" title="Italic" />
      <button className="ql-underline" title="Underline" />
      <button className="ql-strike" title="Strikethrough" />
    </span>
    <span className="ql-formats">
      <button className="ql-list" value="ordered" title="Numbered List" />
      <button className="ql-list" value="bullet" title="Bullet List" />
    </span>
    <span className="ql-formats">
      <button className="ql-script" value="sub" title="Subscript" />
      <button className="ql-script" value="super" title="Superscript" />
    </span>
    <span className="ql-formats">
      <button className="ql-align" value="" title="Align Left" />
      <button className="ql-align" value="center" title="Align Center" />
      <button className="ql-align" value="right" title="Align Right" />
      <button className="ql-align" value="justify" title="Justify" />
    </span>
    <span className="ql-formats">
      <button className="ql-image" title="Insert Image">
        <ImageIcon size={16} />
      </button>
      <button className="ql-table" title="Insert Table">
        <Table2 size={16} />
      </button>
      <button className="ql-math" title="Insert LaTeX Formula">
        <span style={{ fontSize: 16, fontWeight: 'bold' }}>&sum;</span>
      </button>
      <button className="ql-clean" title="Clear Formatting" />
    </span>
  </div>
);

function ensureQuillTableStructure(tableEl: HTMLTableElement) {
  const usedIds = new Set<string>();
  const rows = Array.from(tableEl.querySelectorAll('tr'));
  rows.forEach((tr) => {
    const cells = Array.from(tr.children) as HTMLElement[];
    let rowId = cells[0]?.getAttribute('data-row') || '';
    if (!rowId || usedIds.has(rowId)) {
      rowId = `row-${Math.random().toString(36).slice(2, 7)}`;
    }
    usedIds.add(rowId);
    cells.forEach((cell) => {
      cell.setAttribute('data-row', rowId);
      if (!cell.innerHTML.trim()) {
        cell.innerHTML = '<br>';
      }
    });
  });
}

function focusTableCell(cellEl: HTMLElement | null | undefined) {
  if (!cellEl) return;
  const sel = window.getSelection();
  if (!sel) return;
  const range = document.createRange();
  range.selectNodeContents(cellEl);
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
}

export interface FullQuillProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  openMathDialog?: (onInsert: (latex: string) => void, initialLatex?: string) => void;
  toolbarId?: string;
  onImageClick?: (imgElement: HTMLImageElement, htmlValue: string, onChange: (newHtml: string) => void, startEvent?: React.MouseEvent) => void;
  minHeight?: number | string;
  isMini?: boolean;
  className?: string;
}

export default function FullQuill({
  value,
  onChange,
  placeholder,
  openMathDialog,
  toolbarId = 'toolbar',
  onImageClick,
  minHeight = '140px',
  isMini = false,
  className = '',
}: FullQuillProps) {
  const quillRef = useRef<ReactQuill>(null);
  const [showTableDialog, setShowTableDialog] = useState(false);
  const [tableRows, setTableRows] = useState(2);
  const [tableCols, setTableCols] = useState(2);
  const [isInsideTable, setIsInsideTable] = useState(false);
  const activeTableCellRef = useRef<HTMLTableCellElement | null>(null);
  const lastSelectionRef = useRef<{ index: number; length: number } | null>(null);

  // Internal MathLive dialog state for standalone usage (e.g. in QuestionBank)
  const [internalMathOpen, setInternalMathOpen] = useState(false);
  const [internalMathLatex, setInternalMathLatex] = useState('');
  const internalMathCallbackRef = useRef<((latex: string) => void) | null>(null);

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const handleOpenMath = useCallback((onInsert: (latex: string) => void, initialLatex: string = '') => {
    if (openMathDialog) {
      openMathDialog(onInsert, initialLatex);
    } else {
      internalMathCallbackRef.current = onInsert;
      setInternalMathLatex(initialLatex);
      setInternalMathOpen(true);
    }
  }, [openMathDialog]);

  const handleOpenMathRef = useRef(handleOpenMath);
  handleOpenMathRef.current = handleOpenMath;

  const formattedValue = useMemo(() => {
    return latexToQuillFormula(value);
  }, [value]);

  const syncEditorHtml = useCallback(() => {
    if (!quillRef.current) return;
    const quill = quillRef.current.getEditor();
    quill.update(ReactQuill.Quill.sources.USER);
    onChangeRef.current(cleanImageHtml(quill.root.innerHTML));
  }, []);

  const confirmTableInsert = () => {
    if (quillRef.current && tableRows > 0 && tableCols > 0) {
      const quill = quillRef.current.getEditor();
      quill.focus();
      const range = lastSelectionRef.current || quill.getSelection(true) || { index: Math.max(0, quill.getLength() - 1), length: 0 };
      const tableModule = quill.getModule('table') as any;
      if (tableModule) {
        quill.setSelection(range.index, 0, ReactQuill.Quill.sources.SILENT);
        tableModule.insertTable(tableRows, tableCols);
        setTimeout(() => {
          quill.focus();
          const firstCell = quill.root.querySelector('td') as HTMLTableCellElement | null;
          if (firstCell) {
            activeTableCellRef.current = firstCell;
            setIsInsideTable(true);
            const firstCellBlot = quill.scroll.find(firstCell) as any;
            if (firstCellBlot && typeof firstCellBlot.offset === 'function') {
              const offset = firstCellBlot.offset(quill.scroll);
              quill.setSelection(offset, 0, ReactQuill.Quill.sources.SILENT);
              lastSelectionRef.current = { index: offset, length: 0 };
            }
          }
          onChangeRef.current(cleanImageHtml(quill.root.innerHTML));
        }, 30);
      }
    }
    setShowTableDialog(false);
  };

  const handleTableAction = useCallback((action: 'row-above' | 'row-below' | 'col-left' | 'col-right' | 'del-row' | 'del-col' | 'del-table') => {
    if (!quillRef.current) return;
    const quill = quillRef.current.getEditor();
    let cell = activeTableCellRef.current;

    if (!cell || !quill.root.contains(cell)) {
      const range = quill.getSelection() || lastSelectionRef.current;
      if (range) {
        const [line] = quill.getLine(range.index);
        const lineDom = line?.domNode as HTMLElement | undefined;
        const foundFromLine = lineDom?.closest?.('td, th') as HTMLTableCellElement | null;
        if (foundFromLine && quill.root.contains(foundFromLine)) {
          cell = foundFromLine;
        }
      }
    }
    if (!cell || !quill.root.contains(cell)) {
      const sel = window.getSelection();
      const anchorEl = sel?.anchorNode instanceof HTMLElement ? sel.anchorNode : sel?.anchorNode?.parentElement;
      const foundCell = anchorEl?.closest('td, th') as HTMLTableCellElement | null;
      if (foundCell && quill.root.contains(foundCell)) {
        cell = foundCell;
      }
    }
    if (!cell || !quill.root.contains(cell)) {
      cell = quill.root.querySelector('td, th') as HTMLTableCellElement | null;
    }
    if (!cell) return;

    const cellBlot = quill.scroll.find(cell) as any;
    const rowBlot = cellBlot?.parent;
    const bodyBlot = rowBlot?.parent;
    const tableBlot = bodyBlot?.parent;

    if (!cellBlot || !rowBlot || !bodyBlot || !tableBlot) return;

    const seenRowIds = new Set<string>();
    bodyBlot.children.forEach((rBlot: any) => {
      const firstCellDom = rBlot.children.head?.domNode as HTMLElement | undefined;
      let rId = firstCellDom?.getAttribute('data-row') || '';
      if (!rId || seenRowIds.has(rId)) {
        rId = `row-${Math.random().toString(36).slice(2, 7)}`;
      }
      seenRowIds.add(rId);
      rBlot.children.forEach((cBlot: any) => {
        if (cBlot.domNode?.getAttribute('data-row') !== rId) {
          cBlot.domNode?.setAttribute('data-row', rId);
        }
      });
    });

    const colIndex = Math.max(0, cellBlot.prev ? cellBlot.offset(rowBlot) : 0);
    const colCount = Math.max(1, rowBlot.children.length);
    const rowCount = Math.max(1, bodyBlot.children.length);

    const focusBlotCell = (targetBlot: any) => {
      if (!targetBlot) return;
      activeTableCellRef.current = targetBlot.domNode;
      setIsInsideTable(true);
      focusTableCell(targetBlot.domNode);
    };

    const removeEntireTable = () => {
      const tableOffset = tableBlot.offset(quill.scroll);
      tableBlot.remove();
      syncEditorHtml();
      activeTableCellRef.current = null;
      setIsInsideTable(false);
      const safeIndex = Math.min(tableOffset, Math.max(0, quill.getLength() - 1));
      quill.setSelection(safeIndex, 0, ReactQuill.Quill.sources.SILENT);
      lastSelectionRef.current = { index: safeIndex, length: 0 };
    };

    if (action === 'del-table') {
      removeEntireTable();
      return;
    }

    if (action === 'row-above' || action === 'row-below') {
      const tableModule = quill.getModule('table') as any;
      if (tableModule) {
        if (action === 'row-above') {
          tableModule.insertRowAbove();
        } else {
          tableModule.insertRowBelow();
        }
        syncEditorHtml();
        const newRowId = `row-${Math.random().toString(36).slice(2, 7)}`;
        const targetRow = action === 'row-above' ? rowBlot.prev : rowBlot.next;
        if (targetRow) {
          targetRow.children.forEach((cBlot: any) => {
            cBlot.domNode?.setAttribute('data-row', newRowId);
          });
          const focusTarget = targetRow.children.at(Math.min(colIndex, targetRow.children.length - 1)) || targetRow.children.head;
          focusBlotCell(focusTarget);
        }
      }
      return;
    }

    if (action === 'col-left' || action === 'col-right') {
      const tableModule = quill.getModule('table') as any;
      if (tableModule) {
        if (action === 'col-left') {
          tableModule.insertColumnLeft();
        } else {
          tableModule.insertColumnRight();
        }
        syncEditorHtml();
        bodyBlot.children.forEach((rBlot: any) => {
          const firstCellDom = rBlot.children.head?.domNode as HTMLElement | undefined;
          const rowId = firstCellDom?.getAttribute('data-row') || `row-${Math.random().toString(36).slice(2, 7)}`;
          rBlot.children.forEach((cBlot: any) => {
            if (cBlot.domNode?.getAttribute('data-row') !== rowId) {
              cBlot.domNode?.setAttribute('data-row', rowId);
            }
          });
        });
        const targetColIndex = action === 'col-left' ? colIndex : colIndex + 1;
        const focusTarget = rowBlot.children.at(Math.min(targetColIndex, rowBlot.children.length - 1)) || rowBlot.children.head;
        focusBlotCell(focusTarget);
      }
      return;
    }

    if (action === 'del-row') {
      if (rowCount <= 1) {
        removeEntireTable();
        return;
      }
      const fallbackRowBlot = rowBlot.next || rowBlot.prev;
      rowBlot.remove();
      syncEditorHtml();
      const nextCellBlot = fallbackRowBlot?.children?.at(Math.min(colIndex, fallbackRowBlot.children.length - 1)) || fallbackRowBlot?.children?.head;
      if (nextCellBlot) {
        focusBlotCell(nextCellBlot);
      } else {
        activeTableCellRef.current = null;
        setIsInsideTable(false);
      }
      return;
    }

    if (action === 'del-col') {
      if (colCount <= 1) {
        removeEntireTable();
        return;
      }
      bodyBlot.children.forEach((rBlot: any) => {
        const target = rBlot.children.at(colIndex);
        if (target) {
          target.remove();
        }
      });
      syncEditorHtml();
      const nextCellBlot = rowBlot.children.at(Math.min(colIndex, rowBlot.children.length - 1)) || rowBlot.children.head;
      if (nextCellBlot) {
        focusBlotCell(nextCellBlot);
      } else {
        activeTableCellRef.current = null;
        setIsInsideTable(false);
      }
    }
  }, [syncEditorHtml]);

  const modules = useMemo(() => ({
    toolbar: {
      container: `#${toolbarId}`,
      handlers: {
        table: () => setShowTableDialog(true),
        align: function (this: any, alignVal: string | false) {
          if (!quillRef.current) return;
          const quill = quillRef.current.getEditor();
          quill.focus();
          const normalizedAlign = alignVal || false;

          if (activeTableCellRef.current && quill.root.contains(activeTableCellRef.current)) {
            const td = activeTableCellRef.current;
            td.classList.remove('ql-align-center', 'ql-align-right', 'ql-align-justify');
            if (normalizedAlign) {
              td.classList.add(`ql-align-${normalizedAlign}`);
              td.style.textAlign = normalizedAlign;
            } else {
              td.style.textAlign = 'left';
            }
          }

          const range = quill.getSelection() || lastSelectionRef.current;
          if (range && range.length > 0) {
            quill.formatLine(range.index, range.length, 'align', normalizedAlign, ReactQuill.Quill.sources.USER);
          } else if (range) {
            quill.formatLine(range.index, 1, 'align', normalizedAlign, ReactQuill.Quill.sources.USER);
          } else {
            quill.formatLine(0, Math.max(1, quill.getLength()), 'align', normalizedAlign, ReactQuill.Quill.sources.USER);
          }
          onChangeRef.current(cleanImageHtml(quill.root.innerHTML));
        },
        math: () => {
          if (!quillRef.current) return;
          const quill = quillRef.current.getEditor();
          const range = lastSelectionRef.current || quill.getSelection(true) || { index: Math.max(0, quill.getLength() - 1), length: 0 };
          handleOpenMathRef.current((latex) => {
            if (!latex || !latex.trim()) return;
            quill.focus();
            quill.insertEmbed(range.index, 'formula', latex.trim(), ReactQuill.Quill.sources.USER);
            quill.setSelection(range.index + 1, 0, ReactQuill.Quill.sources.SILENT);
            onChangeRef.current(cleanImageHtml(quill.root.innerHTML));
          });
        },
        formula: () => {
          if (!quillRef.current) return;
          const quill = quillRef.current.getEditor();
          const range = lastSelectionRef.current || quill.getSelection(true) || { index: Math.max(0, quill.getLength() - 1), length: 0 };
          handleOpenMathRef.current((latex) => {
            if (!latex || !latex.trim()) return;
            quill.focus();
            quill.insertEmbed(range.index, 'formula', latex.trim(), ReactQuill.Quill.sources.USER);
            quill.setSelection(range.index + 1, 0, ReactQuill.Quill.sources.SILENT);
            onChangeRef.current(cleanImageHtml(quill.root.innerHTML));
          });
        }
      }
    },
    table: true
  }), [toolbarId]);

  const checkTableContext = useCallback((targetNode?: Node | null, quillRange?: { index: number; length: number } | null) => {
    if (!quillRef.current) return;
    const quill = quillRef.current.getEditor();

    if (targetNode) {
      const el = targetNode instanceof HTMLElement ? targetNode : targetNode.parentElement;
      const cell = el?.closest('td, th') as HTMLTableCellElement | null;
      if (cell && quill.root.contains(cell)) {
        activeTableCellRef.current = cell;
        setIsInsideTable(true);
        return;
      }
      if (el && quill.root.contains(el)) {
        activeTableCellRef.current = null;
        setIsInsideTable(false);
        return;
      }
    }

    const range = quillRange !== undefined ? quillRange : quill.getSelection();
    if (range) {
      const [line] = quill.getLine(range.index);
      const lineDom = line?.domNode as HTMLElement | undefined;
      const cellFromLine = lineDom?.closest?.('td, th') as HTMLTableCellElement | null;
      if (cellFromLine && quill.root.contains(cellFromLine)) {
        activeTableCellRef.current = cellFromLine;
        setIsInsideTable(true);
        return;
      }
    }

    const sel = window.getSelection();
    const anchorNode = sel?.anchorNode;
    const anchorEl = anchorNode instanceof HTMLElement ? anchorNode : anchorNode?.parentElement;
    if (anchorEl && quill.root.contains(anchorEl)) {
      const cellFromSel = anchorEl.closest('td, th') as HTMLTableCellElement | null;
      if (cellFromSel && quill.root.contains(cellFromSel)) {
        activeTableCellRef.current = cellFromSel;
        setIsInsideTable(true);
      } else {
        activeTableCellRef.current = null;
        setIsInsideTable(false);
      }
    }
  }, []);

  // Real-time conversion of typed \( ... \) to live KaTeX formula embeds
  useEffect(() => {
    if (!quillRef.current) return;
    const quill = quillRef.current.getEditor();

    const handleTextChange = (_delta: any, _oldDelta: any, source: string) => {
      if (source !== ReactQuill.Quill.sources.USER) return;
      const text = quill.getText();
      const match = /\\\(([\s\S]+?)\\\)/.exec(text) || /\\\[([\s\S]+?)\\\]/.exec(text) || /\$\$([\s\S]+?)\$\$/.exec(text);
      if (match) {
        const start = match.index;
        const length = match[0].length;
        const latex = match[1].trim();
        quill.deleteText(start, length, ReactQuill.Quill.sources.USER);
        quill.insertEmbed(start, 'formula', latex, ReactQuill.Quill.sources.USER);
        quill.setSelection(start + 1, 0, ReactQuill.Quill.sources.SILENT);
        onChangeRef.current(cleanImageHtml(quill.root.innerHTML));
      }
    };

    quill.on('text-change', handleTextChange);
    return () => {
      quill.off('text-change', handleTextChange);
    };
  }, []);

  const handleEditorMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('.quill-table-context-bar') || target.closest('.ql-toolbar')) {
      return;
    }
    const formulaTarget = target.closest('.ql-formula') as HTMLElement | null;
    if (formulaTarget && quillRef.current) {
      e.preventDefault();
      e.stopPropagation();
      const latex = formulaTarget.getAttribute('data-value') || '';
      const quill = quillRef.current.getEditor();
      const blot = (quill as any).scroll?.find?.(formulaTarget);
      if (blot) {
        const offset = typeof blot.offset === 'function' ? blot.offset((quill as any).scroll) : 0;
        handleOpenMathRef.current((newLatex) => {
          if (!newLatex || !newLatex.trim()) return;
          quill.focus();
          blot.remove();
          quill.insertEmbed(offset, 'formula', newLatex.trim(), ReactQuill.Quill.sources.USER);
          quill.setSelection(offset + 1, 0, ReactQuill.Quill.sources.SILENT);
          onChangeRef.current(cleanImageHtml(quill.root.innerHTML));
        }, latex);
        return;
      }
    }
    checkTableContext(target);
    if (target.tagName === 'IMG' && onImageClick) {
      if ((target as HTMLImageElement).style.outline) {
        (target as HTMLImageElement).style.outline = '';
      }
      onImageClick(target as HTMLImageElement, value, onChange, e);
    }
  };

  const handleEditorKeyDown = (e: React.KeyboardEvent) => {
    if (!quillRef.current) return;
    const quill = quillRef.current.getEditor();
    const sel = window.getSelection();
    const anchorEl = sel?.anchorNode instanceof HTMLElement ? sel.anchorNode : sel?.anchorNode?.parentElement;
    const currentCell = (anchorEl?.closest('td, th') || activeTableCellRef.current) as HTMLTableCellElement | null;

    if (!currentCell || !quill.root.contains(currentCell)) return;

    const tr = currentCell.closest('tr') as HTMLTableRowElement | null;
    const table = currentCell.closest('table') as HTMLTableElement | null;
    if (!tr || !table) return;

    if (e.key === 'Tab') {
      e.preventDefault();
      ensureQuillTableStructure(table);
      const allCells = Array.from(table.querySelectorAll('td, th')) as HTMLTableCellElement[];
      const idx = allCells.indexOf(currentCell);
      if (e.shiftKey) {
        if (idx > 0) {
          const prevCell = allCells[idx - 1];
          activeTableCellRef.current = prevCell;
          focusTableCell(prevCell);
        }
      } else {
        if (idx >= 0 && idx < allCells.length - 1) {
          const nextCell = allCells[idx + 1];
          activeTableCellRef.current = nextCell;
          focusTableCell(nextCell);
        } else {
          activeTableCellRef.current = currentCell;
          handleTableAction('row-below');
          const updatedRows = Array.from(table.querySelectorAll('tr'));
          const lastRowFirstCell = updatedRows[updatedRows.length - 1]?.querySelector('td, th') as HTMLTableCellElement | null;
          if (lastRowFirstCell) {
            activeTableCellRef.current = lastRowFirstCell;
            focusTableCell(lastRowFirstCell);
          }
        }
      }
      return;
    }

    if (e.key === 'Backspace' || e.key === 'Delete') {
      const range = quill.getSelection();
      if (!range) return;
      const [startLine, startOffset] = quill.getLine(range.index);
      const [endLine] = quill.getLine(range.index + range.length);

      if (range.length === 0 && startLine) {
        if (e.key === 'Backspace' && startOffset === 0) {
          e.preventDefault();
          return;
        }
        if (e.key === 'Delete' && startOffset >= startLine.length() - 1) {
          e.preventDefault();
          return;
        }
      } else if (range.length > 0 && startLine !== endLine) {
        e.preventDefault();
        ensureQuillTableStructure(table);
        const domRange = sel && sel.rangeCount > 0 ? sel.getRangeAt(0) : null;
        if (domRange) {
          const allCells = Array.from(table.querySelectorAll('td, th')) as HTMLTableCellElement[];
          allCells.forEach((td) => {
            if (domRange.intersectsNode(td)) {
              td.innerHTML = '<br>';
            }
          });
          syncEditorHtml();
          focusTableCell(currentCell);
        }
      }
    }
  };

  return (
    <div
      className={`rich-editor-wrapper ${isMini ? 'mini-editor' : ''} ${className}`.trim()}
      onMouseDown={handleEditorMouseDown}
      onKeyUp={() => checkTableContext()}
      onKeyDown={handleEditorKeyDown}
      style={minHeight ? ({ ['--ql-min-height' as any]: typeof minHeight === 'number' ? `${minHeight}px` : minHeight } as React.CSSProperties) : undefined}
    >
      <CustomToolbar id={toolbarId} />
      {isInsideTable && (
        <div
          className="quill-table-context-bar"
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <span className="quill-table-bar-label">
            <Table2 size={13} /> Table:
          </span>
          <button type="button" className="quill-table-bar-btn" onClick={() => handleTableAction('row-above')} title="Insert Row Above">
            + Row Above
          </button>
          <button type="button" className="quill-table-bar-btn" onClick={() => handleTableAction('row-below')} title="Insert Row Below">
            + Row Below
          </button>
          <span className="quill-table-bar-sep" />
          <button type="button" className="quill-table-bar-btn" onClick={() => handleTableAction('col-left')} title="Insert Column Left">
            + Col Left
          </button>
          <button type="button" className="quill-table-bar-btn" onClick={() => handleTableAction('col-right')} title="Insert Column Right">
            + Col Right
          </button>
          <span className="quill-table-bar-sep" />
          <button type="button" className="quill-table-bar-btn danger" onClick={() => handleTableAction('del-row')} title="Delete Current Row">
            Delete Row
          </button>
          <button type="button" className="quill-table-bar-btn danger" onClick={() => handleTableAction('del-col')} title="Delete Current Column">
            Delete Col
          </button>
          <button type="button" className="quill-table-bar-btn danger" onClick={() => handleTableAction('del-table')} title="Delete Entire Table">
            Delete Table
          </button>
        </div>
      )}
      <ReactQuill
        ref={quillRef}
        theme="snow"
        value={formattedValue}
        onChange={onChange}
        onChangeSelection={(range) => {
          if (range) {
            lastSelectionRef.current = { index: range.index, length: range.length };
            checkTableContext(null, range);
          }
        }}
        useSemanticHTML={false}
        modules={modules}
        placeholder={placeholder}
        style={{ background: 'white', borderRadius: '0 0 var(--radius-md) var(--radius-md)' }}
      />

      {showTableDialog && (
        <div className="modal-overlay" style={{ zIndex: 12000 }}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h2 className="modal-title">Insert Table</h2>
              <button className="modal-close-btn" onClick={() => setShowTableDialog(false)}>✕</button>
            </div>
            <div className="modal-content">
              <div className="property-field">
                <label className="property-label">Rows</label>
                <input
                  type="number"
                  autoFocus
                  className="property-input"
                  value={tableRows}
                  onChange={(e) => setTableRows(Math.max(1, parseInt(e.target.value) || 1))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') confirmTableInsert();
                    if (e.key === 'Escape') setShowTableDialog(false);
                  }}
                  min={1}
                />
              </div>
              <div className="property-field">
                <label className="property-label">Columns</label>
                <input
                  type="number"
                  className="property-input"
                  value={tableCols}
                  onChange={(e) => setTableCols(Math.max(1, parseInt(e.target.value) || 1))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') confirmTableInsert();
                    if (e.key === 'Escape') setShowTableDialog(false);
                  }}
                  min={1}
                />
              </div>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setShowTableDialog(false)}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={confirmTableInsert}>Insert Table</button>
            </div>
          </div>
        </div>
      )}

      {/* Built-in MathLive dialog for standalone mode */}
      {!openMathDialog && (
        <MathLiveDialog
          open={internalMathOpen}
          initialLatex={internalMathLatex}
          onClose={() => setInternalMathOpen(false)}
          onInsert={(latex) => {
            if (internalMathCallbackRef.current) {
              internalMathCallbackRef.current(latex);
            }
          }}
        />
      )}
    </div>
  );
}
