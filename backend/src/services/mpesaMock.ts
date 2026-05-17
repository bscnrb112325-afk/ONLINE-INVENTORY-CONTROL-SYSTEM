// This is a mock service for M-Pesa API integration.
// It simulates the process of an STK Push (Lipa Na M-Pesa Online).

export const triggerSTKPush = async (phoneNumber: string, amount: number, reference: string) => {
  console.log(`[M-PESA MOCK] Triggering STK push to ${phoneNumber} for Ksh ${amount}...`);
  
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  // Simulate an 80% success rate
  const isSuccess = Math.random() > 0.2;
  
  if (isSuccess) {
    const mockReceipt = `MP${Math.floor(Math.random() * 10000000).toString().padStart(8, '0')}`;
    console.log(`[M-PESA MOCK] Success! Receipt: ${mockReceipt}`);
    return {
      success: true,
      transactionId: mockReceipt,
      message: "Payment received successfully."
    };
  } else {
    console.log(`[M-PESA MOCK] Failed or cancelled by user.`);
    return {
      success: false,
      transactionId: null,
      message: "Payment failed or cancelled by user."
    };
  }
};
