import { useState, useRef } from 'react';
import type { MonthlyData } from '../types';
import {
  parseCSV, type CSVParseResult, type ColumnMapping, MAPPING_LABELS,
  applyMapping, autoDetectMapping, generateSampleCSV,
} from '../utils/csvImport';

interface Props {
  existingData: MonthlyData[];
  onImport: (data: MonthlyData[]) => void;
}

export default function CSVImport({ existingData, onImport }: Props) {
  const [parseResult, setParseResult] = useState<CSVParseResult | null>(null);
  const [mapping, setMapping] = useState<Partial<ColumnMapping>>({});
  const [importedData, setImportedData] = useState<MonthlyData[] | null>(null);
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview' | 'done'>('upload');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    const result = await parseCSV(file);
    setParseResult(result);
    const autoMapping = autoDetectMapping(result.headers);
    setMapping(autoMapping);
    setStep('mapping');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.csv')) handleFile(file);
  };

  const handleApplyMapping = () => {
    if (!parseResult) return;
    const data = applyMapping(parseResult.data, mapping as ColumnMapping);
    setImportedData(data);
    setStep('preview');
  };

  const handleConfirmImport = () => {
    if (!importedData) return;
    // 重複チェック: 同じ年月は上書き
    const existingMap = new Map(existingData.map(d => [d.yearMonth, d]));
    importedData.forEach(d => existingMap.set(d.yearMonth, d));
    const merged = Array.from(existingMap.values()).sort((a, b) => a.yearMonth.localeCompare(b.yearMonth));
    onImport(merged);
    setStep('done');
  };

  const handleDownloadSample = () => {
    const csv = generateSampleCSV();
    const bom = '\uFEFF';
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample_dental_data.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleLoadSample = () => {
    const csv = generateSampleCSV();
    const blob = new Blob([csv], { type: 'text/csv' });
    const file = new File([blob], 'sample.csv', { type: 'text/csv' });
    handleFile(file);
  };

  const handleReset = () => {
    setParseResult(null);
    setMapping({});
    setImportedData(null);
    setStep('upload');
  };

  return (
    <div>
      <div className="section-header">
        <h2 className="section-title">データ取込</h2>
      </div>

      {step === 'upload' && (
        <>
          <div className="card">
            <div
              className="upload-zone"
              onDrop={handleDrop}
              onDragOver={e => e.preventDefault()}
              onClick={() => fileRef.current?.click()}
            >
              <div className="upload-icon" style={{ fontSize: 48 }}>📄</div>
              <div className="upload-text">CSVファイルをドラッグ＆ドロップ</div>
              <div className="upload-hint">またはクリックしてファイルを選択</div>
              <input
                ref={fileRef}
                type="file"
                accept=".csv"
                style={{ display: 'none' }}
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                }}
              />
            </div>
            <div style={{ marginTop: 16, display: 'flex', gap: 8, justifyContent: 'center' }}>
              <button className="btn btn-secondary btn-sm" onClick={handleDownloadSample}>
                サンプルCSVダウンロード
              </button>
              <button className="btn btn-primary btn-sm" onClick={handleLoadSample}>
                サンプルデータで試す
              </button>
            </div>
          </div>

          {existingData.length > 0 && (
            <div className="card">
              <div className="card-title">取込済みデータ</div>
              <div style={{ fontSize: 14, color: '#6b7280' }}>
                {existingData.length}ヶ月分のデータ（{existingData[0]?.yearMonth} 〜 {existingData[existingData.length - 1]?.yearMonth}）
              </div>
              <div className="data-preview" style={{ maxHeight: 300 }}>
                <table>
                  <thead>
                    <tr>
                      <th>年月</th>
                      <th>総売上</th>
                      <th>保険売上</th>
                      <th>自費売上</th>
                      <th>延患者数</th>
                      <th>新患数</th>
                      <th>再来</th>
                    </tr>
                  </thead>
                  <tbody>
                    {existingData.map(d => (
                      <tr key={d.yearMonth}>
                        <td>{d.yearMonth}</td>
                        <td>{d.totalRevenue.toLocaleString()}</td>
                        <td>{d.insuranceRevenue.toLocaleString()}</td>
                        <td>{d.selfPayRevenue.toLocaleString()}</td>
                        <td>{d.totalPatients}</td>
                        <td>{d.newPatients}</td>
                        <td>{d.returnPatients}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {step === 'mapping' && parseResult && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">列マッピング設定</div>
            <button className="btn btn-secondary btn-sm" onClick={handleReset}>戻る</button>
          </div>
          {parseResult.errors.length > 0 && (
            <div style={{ background: '#fef3c7', padding: 12, borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
              {parseResult.errors.slice(0, 3).map((e, i) => <div key={i}>{e}</div>)}
            </div>
          )}
          <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
            CSVの列を各項目にマッピングしてください。自動検出された項目は事前に設定されています。
          </div>
          {(Object.keys(MAPPING_LABELS) as (keyof ColumnMapping)[]).map(field => (
            <div key={field} className="mapping-row">
              <div className="mapping-label">
                {MAPPING_LABELS[field]}
                {field === 'yearMonth' && ' *'}
              </div>
              <select
                className="form-input"
                value={mapping[field] || ''}
                onChange={e => setMapping({ ...mapping, [field]: e.target.value })}
              >
                <option value="">（未選択）</option>
                {parseResult.headers.map(h => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>
          ))}

          <div style={{ marginTop: 16 }}>
            <div className="card-title" style={{ marginBottom: 8 }}>プレビュー（先頭3行）</div>
            <div className="data-preview">
              <table>
                <thead>
                  <tr>
                    {parseResult.headers.map(h => <th key={h}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {parseResult.data.slice(0, 3).map((row, i) => (
                    <tr key={i}>
                      {parseResult.headers.map(h => <td key={h}>{row[h]}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="btn-group">
            <button className="btn btn-primary" onClick={handleApplyMapping} disabled={!mapping.yearMonth}>
              マッピングを適用
            </button>
          </div>
        </div>
      )}

      {step === 'preview' && importedData && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">取込データ確認</div>
            <button className="btn btn-secondary btn-sm" onClick={() => setStep('mapping')}>戻る</button>
          </div>
          <div style={{ fontSize: 14, color: '#16a34a', marginBottom: 16 }}>
            {importedData.length}ヶ月分のデータを検出しました
          </div>
          <div className="data-preview" style={{ maxHeight: 400 }}>
            <table>
              <thead>
                <tr>
                  <th>年月</th>
                  <th>総売上</th>
                  <th>保険売上</th>
                  <th>自費売上</th>
                  <th>延患者数</th>
                  <th>新患数</th>
                  <th>再来</th>
                  <th>キャンセル</th>
                  <th>予約</th>
                  <th>メンテ</th>
                </tr>
              </thead>
              <tbody>
                {importedData.map(d => (
                  <tr key={d.yearMonth}>
                    <td>{d.yearMonth}</td>
                    <td>{d.totalRevenue.toLocaleString()}</td>
                    <td>{d.insuranceRevenue.toLocaleString()}</td>
                    <td>{d.selfPayRevenue.toLocaleString()}</td>
                    <td>{d.totalPatients}</td>
                    <td>{d.newPatients}</td>
                    <td>{d.returnPatients}</td>
                    <td>{d.cancelCount}</td>
                    <td>{d.appointmentCount}</td>
                    <td>{d.maintenancePatients}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="btn-group">
            <button className="btn btn-primary" onClick={handleConfirmImport}>
              データを取り込む
            </button>
          </div>
        </div>
      )}

      {step === 'done' && (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>データ取込が完了しました</div>
          <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 20 }}>
            ダッシュボードでKPIを確認できます
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button className="btn btn-secondary" onClick={handleReset}>
              さらにデータを追加
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
