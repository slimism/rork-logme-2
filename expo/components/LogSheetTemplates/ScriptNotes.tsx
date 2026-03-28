import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Button } from '@/components/Button';
import { Table, TableColumn, TableRow } from '@/components/Table';
import { ScriptNotesData } from '@/types';
import { useProjectStore } from '@/store/projectStore';

interface ScriptNotesProps {
  logSheetId: string;
  initialData?: ScriptNotesData;
  onSave?: () => void;
}

interface ScriptNotesRow {
  id: string;
  scene: string;
  take: string;
  page: string;
  line: string;
  notes: string;
  continuity: string;
  timing: string;
  status: string;
}

export const ScriptNotes: React.FC<ScriptNotesProps> = ({ 
  logSheetId, 
  initialData,
  onSave
}) => {
  const { updateLogSheet } = useProjectStore();
  
  const [rows, setRows] = useState<ScriptNotesRow[]>(() => {
    if (initialData && (initialData as any).rows) {
      return (initialData as any).rows;
    }
    return [
      {
        id: '1',
        scene: '',
        take: '',
        page: '',
        line: '',
        notes: '',
        continuity: '',
        timing: '',
        status: '',
      }
    ];
  });

  const columns: TableColumn[] = [
    { key: 'scene', title: 'Scene', width: 80, editable: true },
    { key: 'take', title: 'Take', width: 70, editable: true, type: 'number' },
    { key: 'page', title: 'Page', width: 80, editable: true },
    { key: 'line', title: 'Line', width: 80, editable: true },
    { key: 'notes', title: 'Script Notes', width: 180, editable: true, type: 'multiline' },
    { key: 'continuity', title: 'Continuity', width: 150, editable: true, type: 'multiline' },
    { key: 'timing', title: 'Timing', width: 100, editable: true },
    { key: 'status', title: 'Status', width: 100, editable: true },
  ];

  const handleCellChange = (rowId: string, columnKey: string, value: string) => {
    setRows(prev => prev.map(row => 
      row.id === rowId ? { ...row, [columnKey]: value } : row
    ));
  };

  const handleAddRow = () => {
    const newRow: ScriptNotesRow = {
      id: Date.now().toString(),
      scene: '',
      take: '',
      page: '',
      line: '',
      notes: '',
      continuity: '',
      timing: '',
      status: '',
    };
    setRows(prev => [...prev, newRow]);
  };

  const handleDeleteRow = (rowId: string) => {
    if (rows.length > 1) {
      setRows(prev => prev.filter(row => row.id !== rowId));
    }
  };

  const handleSave = () => {
    updateLogSheet(logSheetId, { rows });
    if (onSave) onSave();
  };

  return (
    <View style={styles.container}>
      <Table
        columns={columns}
        data={rows}
        onCellChange={handleCellChange}
        onAddRow={handleAddRow}
        onDeleteRow={handleDeleteRow}
        maxHeight={500}
      />
      
      <View style={styles.buttonContainer}>
        <Button 
          title="Save Script Notes" 
          onPress={handleSave} 
          style={styles.button}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  buttonContainer: {
    marginTop: 20,
    marginBottom: 40,
  },
  button: {
    alignSelf: 'center',
    minWidth: 150,
  },
});