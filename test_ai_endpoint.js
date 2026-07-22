async function test() {
  const res = await fetch('http://localhost:8000/identify-product', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ barcode: "123456789" })
  });
  const data = await res.json();
  console.log("AI response:", data);
}

test();
