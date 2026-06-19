import { UserButton, useUser } from '@clerk/clerk-react';
import { Menu, Bell } from 'lucide-react';

const Navbar = () => {
  const { user } = useUser();

  return (
    <div className="navbar bg-base-100 shadow-sm px-4 lg:px-8 border-b border-base-200">
      <div className="flex-none md:hidden">
        <label htmlFor="my-drawer-2" className="btn btn-square btn-ghost drawer-button">
          <Menu size={24} />
        </label>
      </div>
      
      <div className="flex-1">
        <h1 className="text-xl font-semibold hidden md:block">
           WELCOME BACK TO ONLINE INVENTORY CONTROL SYSTEM
        </h1>
      </div>
      
      <div className="flex-none gap-4">
        <button className="btn btn-ghost btn-circle">
          <div className="indicator">
            <Bell size={20} />
            <span className="badge badge-xs badge-primary indicator-item"></span>
          </div>
        </button>
        <UserButton 
          afterSignOutUrl="/sign-in"
          appearance={{
            elements: {
              avatarBox: "w-10 h-10 ring-2 ring-primary ring-offset-2 ring-offset-base-100 rounded-full"
            }
          }}
        />
      </div>
    </div>
  );
};

export default Navbar;
