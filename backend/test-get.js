async function test() {
  const res = await fetch('http://localhost:5000/api/users', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer mock`
    }
  });
  console.log("GET Status:", res.status);
  const text = await res.text();
  console.log("GET Body:", text);
}
test();
