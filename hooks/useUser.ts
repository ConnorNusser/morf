import { userService } from "@/lib/userService";
import { UserProfile } from "@/types";
import { useEffect, useState } from "react";

export const useUser = () => {
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

    useEffect(() => {
        const fetchUserProfile = async () => {
            const profile = await userService.getRealUserProfile();
            setUserProfile(profile);
        }
        fetchUserProfile();
    }, []);

    return { userProfile };
}