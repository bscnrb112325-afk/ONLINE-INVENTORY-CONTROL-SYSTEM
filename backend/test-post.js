async function test() {
  const res = await fetch('http://localhost:5000/api/users/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer mock`
    },
    body: JSON.stringify({})
  });
  console.log("Status:", res.status);
  const text = await res.text();
  console.log("Body:", text);
}
test();
