import React from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { colors } from '@/constants/colors';

export interface TableColumn {
  key: string;
  title: string;
  width?: number;
  editable?: boolean;
  type?: 'text' | 'number' | 'multiline';
}

export interface TableRow {
  id: string;
  [key: string]: any;
}

interface TableProps {
  columns: TableColumn[];
  data: TableRow[];
  onCellChange: (rowId: string, columnKey: string, value: string) => void;
  onAddRow?: () => void;
  onDeleteRow?: (rowId: string) => void;
  showAddButton?: boolean;
  maxHeight?: number;
}

export const Table: React.FC<TableProps> = ({
  columns,
  data,
  onCellChange,
  onAddRow,
  onDeleteRow,
  showAddButton = true,
  maxHeight = 400,
}) => {
  const defaultColumnWidth = 120;

  const renderCell = (row: TableRow, column: TableColumn) => {
    const value = row[column.key] || '';
    
    if (!column.editable) {
      return (
        <Text style={[styles.cellText, { width: column.width || defaultColumnWidth }]}>
          {value}
        </Text>
      );
    }

    return (
      <TextInput
        style={[
          styles.cellInput,
          { 
            width: column.width || defaultColumnWidth,
            height: column.type === 'multiline' ? 60 : 40,
          }
        ]}
        value={value}
        onChangeText={(text) => onCellChange(row.id, column.key, text)}
        placeholder={`Enter ${column.title.toLowerCase()}`}
        multiline={column.type === 'multiline'}
        keyboardType={column.type === 'number' ? 'numeric' : 'default'}
        textAlignVertical={column.type === 'multiline' ? 'top' : 'center'}
      />
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          {/* Header */}
          <View style={styles.headerRow}>
            {columns.map((column) => (
              <View
                key={column.key}
                style={[
                  styles.headerCell,
                  { width: column.width || defaultColumnWidth }
                ]}
              >
                <Text style={styles.headerText}>{column.title}</Text>
              </View>
            ))}
            {onDeleteRow && (
              <View style={[styles.headerCell, { width: 50 }]}>
                <Text style={styles.headerText}>Action</Text>
              </View>
            )}
          </View>

          {/* Data Rows */}
          <ScrollView style={{ maxHeight }} showsVerticalScrollIndicator={false}>
            {data.map((row, index) => (
              <View key={row.id} style={[styles.dataRow, index % 2 === 0 && styles.evenRow]}>
                {columns.map((column) => (
                  <View
                    key={`${row.id}-${column.key}`}
                    style={[
                      styles.dataCell,
                      { width: column.width || defaultColumnWidth }
                    ]}
                  >
                    {renderCell(row, column)}
                  </View>
                ))}
                {onDeleteRow && (
                  <View style={[styles.dataCell, { width: 50 }]}>
                    <TouchableOpacity onPress={() => onDeleteRow(row.id)}>
                      <Text style={styles.deleteButton}>×</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))}
          </ScrollView>

          {/* Add Row Button */}
          {showAddButton && onAddRow && (
            <View style={styles.addRowContainer}>
              <TouchableOpacity onPress={onAddRow}>
                <Text style={styles.addRowButton}>+ Add Row</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background as string,
  },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: colors.primary as string,
  },
  headerCell: {
    padding: 12,
    borderRightWidth: 1,
    borderRightColor: colors.background as string,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerText: {
    color: colors.background as string,
    fontWeight: '600',
    fontSize: 14,
    textAlign: 'center',
  },
  dataRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border as string,
  },
  evenRow: {
    backgroundColor: colors.card as string,
  },
  dataCell: {
    padding: 8,
    borderRightWidth: 1,
    borderRightColor: colors.border as string,
    justifyContent: 'center',
  },
  cellText: {
    fontSize: 14,
    color: colors.text as string,
    textAlign: 'center',
  },
  cellInput: {
    fontSize: 14,
    color: colors.text as string,
    backgroundColor: colors.background as string,
    borderWidth: 1,
    borderColor: colors.border as string,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  deleteButton: {
    fontSize: 20,
    color: colors.error as string,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  addRowContainer: {
    padding: 16,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border as string,
  },
  addRowButton: {
    color: colors.primary as string,
    fontSize: 16,
    fontWeight: '600',
  },
});