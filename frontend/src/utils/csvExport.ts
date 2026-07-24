export const downloadCSV = (data: any[], filename: string) => {
  if (!data || data.length === 0) {
    alert("No data available to export.");
    return;
  }

  // Extract headers
  const headers = Object.keys(data[0]);
  
  // Format rows
  const csvRows = [];
  csvRows.push(headers.join(',')); // Add header row

  for (const row of data) {
    const values = headers.map(header => {
      let val = row[header];
      if (val === null || val === undefined) {
        val = '';
      } else if (typeof val === 'object') {
        // Simple stringification for nested objects
        val = JSON.stringify(val).replace(/"/g, '""');
      } else {
        val = val.toString().replace(/"/g, '""');
      }
      // Escape commas by quoting
      return `"${val}"`;
    });
    csvRows.push(values.join(','));
  }

  const csvContent = csvRows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  
  const link = document.createElement('a');
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};
