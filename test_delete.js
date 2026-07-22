async function test() {
  const res = await fetch('http://localhost:3000/api/inventory/goods');
  const data = await res.json();
  if (data.length > 0) {
    const id = data[0].id;
    console.log("Found ID to delete:", id);
    const delRes = await fetch('http://localhost:3000/api/inventory/goods/' + id, { method: 'DELETE' });
    const delData = await delRes.text();
    console.log("Delete response:", delRes.status, delData);
  } else {
    console.log("No goods found");
  }
}

test();
