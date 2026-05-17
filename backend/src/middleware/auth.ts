
export const auth = (req:any, res:any, next:any) => {
  // simple mock auth
  req.user = { role: "admin" };
  next();
};
