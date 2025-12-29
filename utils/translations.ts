export const translations = {
    English: {
        nav: {
            feed: 'Feed',
            chats: 'Chats',
            spaces: 'Spaces',
            discover: 'Discover',
            profile: 'Profile',
            wallet: 'Wallet'
        },
        headers: {
            settings: 'Settings',
            notifications: 'Notifications',
            forYou: 'For you',
            following: 'Following',
            live: 'Happening Now',
            popular: 'Popular Spaces'
        },
        actions: {
            logout: 'Log Out',
            editProfile: 'Edit Profile'
        }
    },
    Spanish: {
        nav: {
            feed: 'Inicio',
            chats: 'Chats',
            spaces: 'Comunidades',
            discover: 'Explorar',
            profile: 'Perfil',
            wallet: 'Billetera'
        },
        headers: {
            settings: 'Configuración',
            notifications: 'Notificaciones',
            forYou: 'Para ti',
            following: 'Siguiendo',
            live: 'En vivo ahora',
            popular: 'Comunidades Populares'
        },
        actions: {
            logout: 'Cerrar Sesión',
            editProfile: 'Editar Perfil'
        }
    },
    French: {
        nav: {
            feed: 'Fil',
            chats: 'Discussions',
            spaces: 'Espaces',
            discover: 'Découvrir',
            profile: 'Profil',
            wallet: 'Portefeuille'
        },
        headers: {
            settings: 'Paramètres',
            notifications: 'Notifications',
            forYou: 'Pour toi',
            following: 'Abonnements',
            live: 'En direct',
            popular: 'Espaces Populaires'
        },
        actions: {
            logout: 'Se déconnecter',
            editProfile: 'Modifier le profil'
        }
    },
    German: {
        nav: {
            feed: 'Startseite',
            chats: 'Chats',
            spaces: 'Spaces',
            discover: 'Entdecken',
            profile: 'Profil',
            wallet: 'Wallet'
        },
        headers: {
            settings: 'Einstellungen',
            notifications: 'Mitteilungen',
            forYou: 'Für dich',
            following: 'Folge ich',
            live: 'Jetzt live',
            popular: 'Beliebte Spaces'
        },
        actions: {
            logout: 'Abmelden',
            editProfile: 'Profil bearbeiten'
        }
    },
    Chinese: { // Simplified
        nav: {
            feed: '主页',
            chats: '聊天',
            spaces: '空间',
            discover: '发现',
            profile: '个人主页',
            wallet: '钱包'
        },
        headers: {
            settings: '设置',
            notifications: '通知',
            forYou: '推荐',
            following: '关注',
            live: '正在直播',
            popular: '热门空间'
        },
        actions: {
            logout: '退出登录',
            editProfile: '编辑资料'
        }
    },
    Arabic: {
        nav: {
            feed: 'الرئيسية',
            chats: 'المحادثات',
            spaces: 'المساحات',
            discover: 'اكتشف',
            profile: 'الملف الشخصي',
            wallet: 'المحفظة'
        },
        headers: {
            settings: 'الإعدادات',
            notifications: 'الإشعارات',
            forYou: 'لك',
            following: 'أتابعهم',
            live: 'مباشر الآن',
            popular: 'مساحات شائعة'
        },
        actions: {
            logout: 'تسجيل الخروج',
            editProfile: 'تعديل الملف'
        }
    }
    // Add other languages as needed with fallbacks
};

export type Language = keyof typeof translations;
