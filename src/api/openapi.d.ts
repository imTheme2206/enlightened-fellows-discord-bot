export interface paths {
    "/api/health": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["getApiHealth"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/job-logs": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["getApiJob-logs"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/genshin-codes": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["getApiGenshin-codes"];
        put?: never;
        post: operations["postApiGenshin-codes"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/channels": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["getApiChannels"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/fetch-armors": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["postApiFetch-armors"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/mh-wilds/skills": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["getApiMh-wildsSkills"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/mh-wilds/search": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["postApiMh-wildsSearch"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/mh-wilds/armors": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["getApiMh-wildsArmors"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/talismans": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["getApiTalismans"];
        put?: never;
        post: operations["postApiTalismans"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/talismans/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete: operations["deleteApiTalismansById"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: never;
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    getApiHealth: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: never;
    };
    "getApiJob-logs": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: never;
    };
    "getApiGenshin-codes": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: never;
    };
    "postApiGenshin-codes": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    code: string;
                    rewards?: string;
                };
                "application/x-www-form-urlencoded": {
                    code: string;
                    rewards?: string;
                };
                "multipart/form-data": {
                    code: string;
                    rewards?: string;
                };
            };
        };
        responses: never;
    };
    getApiChannels: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: never;
    };
    "postApiFetch-armors": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: never;
    };
    "getApiMh-wildsSkills": {
        parameters: {
            query?: {
                type?: "armor" | "weapon";
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Response for status 200 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        id: string;
                        name: string;
                        cleanName: string;
                        type: string;
                        maxLevel: number;
                        icon: string | null;
                    }[];
                };
            };
        };
    };
    "postApiMh-wildsSearch": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    skills: {
                        [key: string]: number;
                    };
                    setSkills?: {
                        [key: string]: number;
                    };
                    groupSkills?: {
                        [key: string]: number;
                    };
                    initialSetCounts?: {
                        [key: string]: number;
                    };
                    initialGroupCounts?: {
                        [key: string]: number;
                    };
                    mandatoryArmor?: (string | null)[];
                    blacklistedArmor?: string[];
                    slotFilters?: {
                        [key: string]: number;
                    };
                    /** @enum {string} */
                    rank?: "low" | "high" | "master";
                };
                "application/x-www-form-urlencoded": {
                    skills: {
                        [key: string]: number;
                    };
                    setSkills?: {
                        [key: string]: number;
                    };
                    groupSkills?: {
                        [key: string]: number;
                    };
                    initialSetCounts?: {
                        [key: string]: number;
                    };
                    initialGroupCounts?: {
                        [key: string]: number;
                    };
                    mandatoryArmor?: (string | null)[];
                    blacklistedArmor?: string[];
                    slotFilters?: {
                        [key: string]: number;
                    };
                    /** @enum {string} */
                    rank?: "low" | "high" | "master";
                };
                "multipart/form-data": {
                    skills: {
                        [key: string]: number;
                    };
                    setSkills?: {
                        [key: string]: number;
                    };
                    groupSkills?: {
                        [key: string]: number;
                    };
                    initialSetCounts?: {
                        [key: string]: number;
                    };
                    initialGroupCounts?: {
                        [key: string]: number;
                    };
                    mandatoryArmor?: (string | null)[];
                    blacklistedArmor?: string[];
                    slotFilters?: {
                        [key: string]: number;
                    };
                    /** @enum {string} */
                    rank?: "low" | "high" | "master";
                };
            };
        };
        responses: {
            /** @description Response for status 200 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        armorNames: string[];
                        rarities: number[];
                        skills: {
                            [key: string]: number;
                        };
                        setSkills: {
                            [key: string]: number;
                        };
                        groupSkills: {
                            [key: string]: number;
                        };
                        decoNames: string[];
                        freeSlots: number[];
                        slots: number[];
                        defense: number;
                        elementalDefenses: {
                            fire: number;
                            water: number;
                            thunder: number;
                            ice: number;
                            dragon: number;
                        };
                    }[];
                };
            };
        };
    };
    "getApiMh-wildsArmors": {
        parameters: {
            query?: {
                type?: "head" | "chest" | "arms" | "waist" | "legs" | "talisman";
                name?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Response for status 200 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        id: string;
                        name: string;
                        type: string;
                        rank: string;
                        rarity: number;
                        defense: number;
                        fireRes: number;
                        waterRes: number;
                        thunderRes: number;
                        iceRes: number;
                        dragonRes: number;
                        slots: (string | number | boolean | null) | {
                            [key: string]: unknown;
                        } | unknown[];
                    }[];
                };
            };
        };
    };
    getApiTalismans: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: never;
    };
    postApiTalismans: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    name?: string;
                    skills: {
                        skillId: string;
                        level: number;
                    }[];
                    /** @default [] */
                    slots?: {
                        /** @enum {string} */
                        type: "weapon" | "armor";
                        size: number;
                    }[];
                };
                "application/x-www-form-urlencoded": {
                    name?: string;
                    skills: {
                        skillId: string;
                        level: number;
                    }[];
                    /** @default [] */
                    slots?: {
                        /** @enum {string} */
                        type: "weapon" | "armor";
                        size: number;
                    }[];
                };
                "multipart/form-data": {
                    name?: string;
                    skills: {
                        skillId: string;
                        level: number;
                    }[];
                    /** @default [] */
                    slots?: {
                        /** @enum {string} */
                        type: "weapon" | "armor";
                        size: number;
                    }[];
                };
            };
        };
        responses: never;
    };
    deleteApiTalismansById: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: never;
    };
}
