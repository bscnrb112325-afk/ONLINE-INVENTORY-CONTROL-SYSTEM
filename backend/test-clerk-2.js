async function test() {
  const clerkRes = await fetch('https://api.clerk.com/v1/users', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer sk_test_MxdaYyB1JSnB9KyMrqJbpU3lUWIGnQ05DRWeHeRzWZ`
    },
    body: JSON.stringify({
      email_address: ["testing404@example.com"],
      password: "StrongPassword123!",
      username: "testing404",
      first_name: "Test",
      skip_password_checks: true,
      skip_password_requirement: true
    })
  });

  if (!clerkRes.ok) {
    console.error("Clerk Error:", clerkRes.status, await clerkRes.json());
  } else {
    console.log("Success:", await clerkRes.json());
  }
}

test();
