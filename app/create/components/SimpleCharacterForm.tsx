'use client';

import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { Button } from '@/app/components/ui/Button';
import { Input } from '@/app/components/ui/Input';
import { Select } from '@/app/components/ui/Select';
import { Card } from '@/app/components/ui/Card';

interface SimpleCharacterFormProps {
  onChosen: (character: { name: string; ageYears: number; looks: string; description: string; filename: string; bookId: string; workflowId: string }) => void;
}

export default function SimpleCharacterForm({ onChosen }: SimpleCharacterFormProps) {
  const [name, setName] = useState('');
  const [ageYears, setAgeYears] = useState<number>(6);
  const [looks, setLooks] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bookId, setBookId] = useState<string | null>(null);
  const [workflowId, setWorkflowId] = useState<string | null>(null);
  const [optionFiles, setOptionFiles] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  // New: character type and details
  const [characterKind, setCharacterKind] = useState<string>('human');
  const [customKind, setCustomKind] = useState<string>('');
  const [characterKindDetails, setCharacterKindDetails] = useState<string>('');

  const canGenerate = useMemo(() => name.trim() && looks.trim() && description.trim(), [name, looks, description]);

  // Listen to SSE for character options
  useEffect(() => {
    if (!workflowId) return;
    let es: EventSource | null = null;
    try {
      es = new EventSource(`/api/workflows/progress/${workflowId}`);
      es.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);
          // Look for character options in filePaths
          if (Array.isArray(data.filePaths) && data.filePaths.length > 0) {
            setOptionFiles(data.filePaths);
            setLoading(false);
          }
          if (data.status === 'failed' || data.status === 'cancelled') {
            setError('Workflow failed');
            setLoading(false);
            es?.close();
          }
        } catch (e) {
          console.error('SSE parse error:', e);
        }
      };
      es.onerror = () => {
        es?.close();
        setLoading(false);
      };
    } catch {}
    return () => { es?.close(); };
  }, [workflowId]);

  const generate = async () => {
    if (!canGenerate) return;
    setLoading(true);
    setError(null);
    setSelectedFile(null);
    setOptionFiles([]);
    try {
      // Start workflow
      const startRes = await fetch('/api/workflows/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!startRes.ok) throw new Error('Failed to start workflow');
      const { bookId: newBookId, workflowId: newWorkflowId } = await startRes.json();
      setBookId(newBookId);
      setWorkflowId(newWorkflowId);

      // Send character spec via update
      const updateRes = await fetch('/api/workflows/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookId: newBookId,
          type: 'setCharacterSpec',
          payload: {
            name: name.trim(),
            ageYears,
            looks: looks.trim(),
            description: description.trim(),
            characterKind: (characterKind === 'custom' ? customKind.trim() : characterKind).trim() || 'human',
            characterKindDetails: characterKindDetails.trim(),
          },
        }),
      });
      if (!updateRes.ok) throw new Error('Failed to send character spec');
    } catch (e: any) {
      setError(e?.message || 'Something went wrong');
      setLoading(false);
    }
  };

  const confirm = async () => {
    if (!selectedFile || !bookId) return;
    try {
      // Send selection via update
      await fetch('/api/workflows/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookId,
          type: 'chooseCharacter',
          payload: selectedFile,
        }),
      });
      onChosen({ name: name.trim(), ageYears, looks: looks.trim(), description: description.trim(), filename: selectedFile, bookId, workflowId: workflowId! });
    } catch (e: any) {
      setError(e?.message || 'Failed to select character');
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h2 className="text-2xl font-semibold">Create your character</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Name</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Milo" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Age (years)</label>
          <Input type="number" value={ageYears} onChange={(e) => setAgeYears(parseInt(e.target.value || '6', 10))} min={2} max={12} />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-1">Looks</label>
          <Input value={looks} onChange={(e) => setLooks(e.target.value)} placeholder="elderly man with white beard and glasses, red flannel shirt, blue vest, brown boots, wooden walking stick" />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-1">Description</label>
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="warm, playful grandfather; tells stories, loves gardening; gentle humor; kind and curious" />
        </div>

        {/* Character type selector */}
        <div>
          <Select
            label="Character type"
            value={characterKind}
            onChange={(e) => setCharacterKind(e.target.value)}
            options={[
              { value: 'human', label: 'Human' },
              { value: 'dog', label: 'Dog' },
              { value: 'cat', label: 'Cat' },
              { value: 'fox', label: 'Fox' },
              { value: 'rabbit', label: 'Rabbit' },
              { value: 'bear', label: 'Bear' },
              { value: 'elephant', label: 'Elephant' },
              { value: 'giraffe', label: 'Giraffe' },
              { value: 'lion', label: 'Lion' },
              { value: 'tiger', label: 'Tiger' },
              { value: 'bird', label: 'Bird' },
              { value: 'dinosaur', label: 'Dinosaur' },
              { value: 'dragon', label: 'Dragon' },
              { value: 'custom', label: 'Other (custom)' },
            ]}
            helpText="Pick who your hero is. You can always add details below."
          />
        </div>
        {characterKind === 'custom' && (
          <div>
            <label className="block text-sm font-medium mb-1">Custom type</label>
            <Input value={customKind} onChange={(e) => setCustomKind(e.target.value)} placeholder="e.g., robot, alien, mermaid" />
          </div>
        )}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-1">Character details (optional)</label>
          <textarea
            className="input-field"
            value={characterKindDetails}
            onChange={(e) => setCharacterKindDetails(e.target.value.slice(0, 200))}
            placeholder="Extra traits, body shape, textures, outfit, etc."
            rows={3}
          />
          <div className="mt-1 text-xs text-gray-500">{characterKindDetails.length}/200</div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={generate} disabled={!canGenerate || loading}>{loading ? 'Generating…' : 'Generate previews'}</Button>
        {error ? <span className="text-red-600 text-sm">{error}</span> : null}
      </div>

      {optionFiles.length > 0 && bookId && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {optionFiles.map((filename) => {
            const url = `/data/${bookId}/characters/options/${filename}`;
            return (
              <Card key={filename} className={`p-2 cursor-pointer ${selectedFile === filename ? 'ring-2 ring-blue-500' : ''}`} onClick={() => setSelectedFile(filename)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="preview" className="w-full h-auto" />
              </Card>
            );
          })}
        </div>
      )}

      {optionFiles.length > 0 && (
        <div className="flex gap-3">
          <Button onClick={confirm} disabled={!selectedFile}>Use this character</Button>
          <Button variant="secondary" onClick={() => { setOptionFiles([]); setSelectedFile(null); setWorkflowId(null); setBookId(null); }}>Back</Button>
        </div>
      )}
    </div>
  );
}


