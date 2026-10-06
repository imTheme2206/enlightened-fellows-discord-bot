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
    "/api/mh-wilds/decorations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["getApiMh-wildsDecorations"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/mh-wilds/weapons": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["getApiMh-wildsWeapons"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/mh-wilds/artian-rules": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["getApiMh-wildsArtian-rules"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/mh-wilds/monsters": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["getApiMh-wildsMonsters"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/mh-wilds/monsters/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        get: operations["getApiMh-wildsMonstersById"];
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
    "/api/mh-wilds/builds/shared": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["getApiMh-wildsBuildsShared"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/mh-wilds/builds/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["getApiMh-wildsBuildsById"];
        put: operations["putApiMh-wildsBuildsById"];
        post?: never;
        delete: operations["deleteApiMh-wildsBuildsById"];
        options?: never;
        head?: never;
        patch: operations["patchApiMh-wildsBuildsById"];
        trace?: never;
    };
    "/api/mh-wilds/builds": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["getApiMh-wildsBuilds"];
        put?: never;
        post: operations["postApiMh-wildsBuilds"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/mh-wilds/builds/import": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["postApiMh-wildsBuildsImport"];
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
            query?: never;
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
                        skills: {
                            id: string;
                            name: string;
                            /** @enum {string} */
                            kind: "armor" | "weapon";
                            maxLevel: number;
                            icon: string | null;
                        }[];
                        bonuses: {
                            id: string;
                            name: string;
                            /** @enum {string} */
                            kind: "set" | "group";
                            icon: string | null;
                            thresholds: {
                                piecesRequired: number;
                                effectName: string;
                                level: number;
                            }[];
                        }[];
                    };
                };
            };
        };
    };
    "getApiMh-wildsArmors": {
        parameters: {
            query?: never;
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
                        /** @enum {string} */
                        type: "head" | "chest" | "arms" | "waist" | "legs" | "talisman";
                        rank: string;
                        rarity: number;
                        defense: number;
                        resistances: {
                            fire: number;
                            water: number;
                            thunder: number;
                            ice: number;
                            dragon: number;
                        };
                        slots: number[];
                        skills: {
                            skillId: string;
                            name: string;
                            level: number;
                        }[];
                        bonuses: {
                            bonusId: string;
                            name: string;
                            /** @enum {string} */
                            kind: "set" | "group";
                        }[];
                    }[];
                };
            };
        };
    };
    "getApiMh-wildsDecorations": {
        parameters: {
            query?: never;
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
                        /** @enum {string} */
                        type: "armor" | "weapon";
                        slotSize: number;
                        skills: {
                            skillId: string;
                            name: string;
                            level: number;
                        }[];
                    }[];
                };
            };
        };
    };
    "getApiMh-wildsWeapons": {
        parameters: {
            query?: {
                /** @enum {string} */
                kind?: "great-sword" | "long-sword" | "sword-shield" | "dual-blades" | "hammer" | "hunting-horn" | "lance" | "gunlance" | "switch-axe" | "charge-blade" | "insect-glaive" | "bow" | "light-bowgun" | "heavy-bowgun";
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
                        /** @enum {string} */
                        kind: "great-sword" | "long-sword" | "sword-shield" | "dual-blades" | "hammer" | "hunting-horn" | "lance" | "gunlance" | "switch-axe" | "charge-blade" | "insect-glaive" | "bow" | "light-bowgun" | "heavy-bowgun";
                        rarity: number;
                        damage: {
                            raw: number;
                            display: number;
                        };
                        affinity: number;
                        specials: {
                            /** @enum {string} */
                            kind: "element" | "status";
                            name: string;
                            damage: {
                                raw: number;
                                display: number;
                            };
                            hidden: boolean;
                        }[];
                        sharpness: {
                            red: number;
                            orange: number;
                            yellow: number;
                            green: number;
                            blue: number;
                            white: number;
                            purple: number;
                        } | null;
                        handicraft: number[] | null;
                        slots: number[];
                        skills: {
                            skillId: string;
                            name: string;
                            level: number;
                        }[];
                        elderseal: string | null;
                        defenseBonus: number;
                        series: string | null;
                        artian: {
                            /** @enum {string} */
                            family: "artian" | "gogma";
                            /** @enum {number} */
                            tier: 6 | 7 | 8;
                            /** @enum {string | null} */
                            focus: "attack" | "affinity" | "element" | null;
                        } | null;
                        kindSpecific: {
                            [key: string]: unknown;
                        };
                    }[];
                };
            };
        };
    };
    "getApiMh-wildsArtian-rules": {
        parameters: {
            query?: never;
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
                        gameVersion: string;
                        retrievedAt: string;
                        production: {
                            parts: number;
                            attackPerPart: number;
                            affinityPerPart: number;
                        };
                        baseStats: {
                            raw: {
                                "6": number;
                                "7": number;
                                "8": number;
                            };
                            affinity: number;
                        };
                        gogmaFocus: {
                            attack: {
                                raw: number;
                                affinity: number;
                            };
                            affinity: {
                                raw: number;
                                affinity: number;
                            };
                            element: {
                                raw: number;
                                affinity: number;
                            };
                        };
                        reinforcement: {
                            maxCount: number;
                            attack: {
                                I: number;
                                II: number;
                                III: number;
                                EX: number;
                            };
                            affinity: {
                                I: number;
                                II: number;
                                III: number;
                                EX: number;
                            };
                            sharpness: {
                                I: number;
                                EX: number;
                            };
                            sharpnessInsectGlaiveI: number;
                            ammo: {
                                I: number;
                                EX: number;
                            };
                            maxExPerType: number;
                            artianMaxPerType: {
                                attack: number;
                                affinity: number;
                                element: number;
                                sharpness: number;
                                ammo: number;
                            };
                        };
                        kinds: {
                            [key: string]: {
                                artianNames: {
                                    "6": string;
                                    "7": string;
                                    "8": string;
                                };
                                gogmaName: string;
                                elements: {
                                    [key: string]: {
                                        r67: number;
                                        r8: number;
                                    };
                                };
                                elementInfusion: number | null;
                                gogmaFocusElementDelta: {
                                    affinity: number;
                                    element: number;
                                } | null;
                                elementBoost: {
                                    I: number;
                                    II: number;
                                    EX: number;
                                } | null;
                            };
                        };
                    };
                };
            };
        };
    };
    "getApiMh-wildsMonsters": {
        parameters: {
            query?: never;
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
                        species: string;
                        baseHealth: number;
                        iconUrl: string;
                    }[];
                };
            };
        };
    };
    "getApiMh-wildsMonstersById": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
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
                        species: string;
                        baseHealth: number;
                        iconUrl: string;
                        description: string;
                        size: {
                            [key: string]: number;
                        };
                        dataVersion: {
                            hash: string;
                            fetchedAt: string;
                        };
                        parts: {
                            id: string;
                            kind: string;
                            name: string;
                            health: number | null;
                            kinsectEssence: string | null;
                            multipliers: {
                                slash: number;
                                blunt: number;
                                pierce: number;
                                fire: number;
                                water: number;
                                thunder: number;
                                ice: number;
                                dragon: number;
                                stun: number;
                            };
                        }[];
                        weaknesses: {
                            /** @enum {string} */
                            kind: "element" | "status" | "effect";
                            name: string;
                            level: number;
                            condition: string | null;
                        }[];
                    };
                };
            };
            /** @description Response for status 404 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        error: {
                            /** @constant */
                            code: "NOT_FOUND";
                            message: string;
                        };
                    };
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
    "getApiMh-wildsBuildsShared": {
        parameters: {
            query?: {
                limit?: number;
                cursor?: string;
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
                        items: {
                            id: string;
                            name: string;
                            description: string | null;
                            isShared: boolean;
                            sharedAt: string | null;
                            revision: number;
                            isStale: boolean;
                            createdAt: string;
                            updatedAt: string;
                            owner: {
                                displayName: string | null;
                                avatarUrl: string | null;
                            } | null;
                        }[];
                        nextCursor: string | null;
                    };
                };
            };
        };
    };
    "getApiMh-wildsBuildsById": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
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
                        description: string | null;
                        isShared: boolean;
                        sharedAt: string | null;
                        revision: number;
                        isStale: boolean;
                        createdAt: string;
                        updatedAt: string;
                        composition: {
                            /** @constant */
                            schemaVersion: 1;
                            positions: {
                                head: {
                                    armorId: string;
                                    name: string;
                                    /** @enum {string} */
                                    type: "head" | "chest" | "arms" | "waist" | "legs";
                                    rank: string;
                                    rarity: number;
                                    defense: number;
                                    resistances: {
                                        fire: number;
                                        water: number;
                                        thunder: number;
                                        ice: number;
                                        dragon: number;
                                    };
                                    slots: number[];
                                    skills: {
                                        skillId: string;
                                        name: string;
                                        level: number;
                                    }[];
                                    bonuses: {
                                        bonusId: string;
                                        name: string;
                                        /** @enum {string} */
                                        kind: "set" | "group";
                                    }[];
                                    decorations: {
                                        slotIndex: number;
                                        decorationId: string;
                                        name: string;
                                        slotSize: number;
                                        skills: {
                                            skillId: string;
                                            name: string;
                                            level: number;
                                        }[];
                                    }[];
                                } | null;
                                chest: {
                                    armorId: string;
                                    name: string;
                                    /** @enum {string} */
                                    type: "head" | "chest" | "arms" | "waist" | "legs";
                                    rank: string;
                                    rarity: number;
                                    defense: number;
                                    resistances: {
                                        fire: number;
                                        water: number;
                                        thunder: number;
                                        ice: number;
                                        dragon: number;
                                    };
                                    slots: number[];
                                    skills: {
                                        skillId: string;
                                        name: string;
                                        level: number;
                                    }[];
                                    bonuses: {
                                        bonusId: string;
                                        name: string;
                                        /** @enum {string} */
                                        kind: "set" | "group";
                                    }[];
                                    decorations: {
                                        slotIndex: number;
                                        decorationId: string;
                                        name: string;
                                        slotSize: number;
                                        skills: {
                                            skillId: string;
                                            name: string;
                                            level: number;
                                        }[];
                                    }[];
                                } | null;
                                arms: {
                                    armorId: string;
                                    name: string;
                                    /** @enum {string} */
                                    type: "head" | "chest" | "arms" | "waist" | "legs";
                                    rank: string;
                                    rarity: number;
                                    defense: number;
                                    resistances: {
                                        fire: number;
                                        water: number;
                                        thunder: number;
                                        ice: number;
                                        dragon: number;
                                    };
                                    slots: number[];
                                    skills: {
                                        skillId: string;
                                        name: string;
                                        level: number;
                                    }[];
                                    bonuses: {
                                        bonusId: string;
                                        name: string;
                                        /** @enum {string} */
                                        kind: "set" | "group";
                                    }[];
                                    decorations: {
                                        slotIndex: number;
                                        decorationId: string;
                                        name: string;
                                        slotSize: number;
                                        skills: {
                                            skillId: string;
                                            name: string;
                                            level: number;
                                        }[];
                                    }[];
                                } | null;
                                waist: {
                                    armorId: string;
                                    name: string;
                                    /** @enum {string} */
                                    type: "head" | "chest" | "arms" | "waist" | "legs";
                                    rank: string;
                                    rarity: number;
                                    defense: number;
                                    resistances: {
                                        fire: number;
                                        water: number;
                                        thunder: number;
                                        ice: number;
                                        dragon: number;
                                    };
                                    slots: number[];
                                    skills: {
                                        skillId: string;
                                        name: string;
                                        level: number;
                                    }[];
                                    bonuses: {
                                        bonusId: string;
                                        name: string;
                                        /** @enum {string} */
                                        kind: "set" | "group";
                                    }[];
                                    decorations: {
                                        slotIndex: number;
                                        decorationId: string;
                                        name: string;
                                        slotSize: number;
                                        skills: {
                                            skillId: string;
                                            name: string;
                                            level: number;
                                        }[];
                                    }[];
                                } | null;
                                legs: {
                                    armorId: string;
                                    name: string;
                                    /** @enum {string} */
                                    type: "head" | "chest" | "arms" | "waist" | "legs";
                                    rank: string;
                                    rarity: number;
                                    defense: number;
                                    resistances: {
                                        fire: number;
                                        water: number;
                                        thunder: number;
                                        ice: number;
                                        dragon: number;
                                    };
                                    slots: number[];
                                    skills: {
                                        skillId: string;
                                        name: string;
                                        level: number;
                                    }[];
                                    bonuses: {
                                        bonusId: string;
                                        name: string;
                                        /** @enum {string} */
                                        kind: "set" | "group";
                                    }[];
                                    decorations: {
                                        slotIndex: number;
                                        decorationId: string;
                                        name: string;
                                        slotSize: number;
                                        skills: {
                                            skillId: string;
                                            name: string;
                                            level: number;
                                        }[];
                                    }[];
                                } | null;
                                talisman: {
                                    /** @enum {string} */
                                    source: "custom" | "scraped";
                                    talismanId: string;
                                    name: string;
                                    slots: {
                                        /** @enum {string} */
                                        type: "weapon" | "armor";
                                        size: number;
                                    }[];
                                    skills: {
                                        skillId: string;
                                        name: string;
                                        level: number;
                                    }[];
                                    bonuses: {
                                        bonusId: string;
                                        name: string;
                                        /** @enum {string} */
                                        kind: "set" | "group";
                                    }[];
                                    decorations: {
                                        slotIndex: number;
                                        decorationId: string;
                                        name: string;
                                        slotSize: number;
                                        skills: {
                                            skillId: string;
                                            name: string;
                                            level: number;
                                        }[];
                                    }[];
                                } | null;
                                weapon: {
                                    weaponId?: string | null;
                                    name?: string;
                                    /** @enum {string} */
                                    kind?: "great-sword" | "long-sword" | "sword-shield" | "dual-blades" | "hammer" | "hunting-horn" | "lance" | "gunlance" | "switch-axe" | "charge-blade" | "insect-glaive" | "bow" | "light-bowgun" | "heavy-bowgun";
                                    rarity?: number;
                                    damage?: {
                                        raw: number;
                                        display: number;
                                    };
                                    affinity?: number;
                                    specials?: {
                                        /** @enum {string} */
                                        kind: "element" | "status";
                                        name: string;
                                        damage: {
                                            raw: number;
                                            display: number;
                                        };
                                        hidden: boolean;
                                    }[];
                                    sharpness?: {
                                        red: number;
                                        orange: number;
                                        yellow: number;
                                        green: number;
                                        blue: number;
                                        white: number;
                                        purple: number;
                                    } | null;
                                    slots?: number[];
                                    skills?: {
                                        skillId: string;
                                        name: string;
                                        level: number;
                                    }[];
                                    decorations?: {
                                        slotIndex: number;
                                        decorationId: string;
                                        name: string;
                                        slotSize: number;
                                        skills: {
                                            skillId: string;
                                            name: string;
                                            level: number;
                                        }[];
                                    }[];
                                    customization?: {
                                        /** @enum {string} */
                                        family: "artian" | "gogma";
                                        /** @enum {number} */
                                        tier: 6 | 7 | 8;
                                        /** @enum {string | null} */
                                        focus: "attack" | "affinity" | "element" | null;
                                        config: {
                                            element: "fire" | "water" | "thunder" | "ice" | "dragon" | "poison" | "paralysis" | "sleep" | "blast" | null;
                                            attackParts: number;
                                            affinityParts: number;
                                            elementInfusion: boolean;
                                            reinforcements: {
                                                /** @enum {string} */
                                                type: "attack" | "affinity" | "element" | "sharpness" | "ammo";
                                                /** @enum {string} */
                                                level: "I" | "II" | "III" | "EX";
                                            }[];
                                        };
                                        base: {
                                            damage: {
                                                raw: number;
                                                display: number;
                                            };
                                            affinity: number;
                                        };
                                        sharpnessBonus: number;
                                        ammoBonus: number;
                                        gameVersion: string;
                                    } | null;
                                    setBonus: {
                                        bonusId: string;
                                        name: string;
                                        /** @enum {string} */
                                        kind: "set" | "group";
                                    } | null;
                                    groupBonus: {
                                        bonusId: string;
                                        name: string;
                                        /** @enum {string} */
                                        kind: "set" | "group";
                                    } | null;
                                } | null;
                            };
                            skillDefinitions: {
                                [key: string]: number;
                            };
                            bonusDefinitions: {
                                [key: string]: {
                                    /** @enum {string} */
                                    kind: "set" | "group";
                                    thresholds: {
                                        piecesRequired: number;
                                        effectName: string;
                                        level: number;
                                    }[];
                                };
                            };
                        };
                    };
                };
            };
        };
    };
    "putApiMh-wildsBuildsById": {
        parameters: {
            query: {
                revision: number;
            };
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    name: string;
                    description?: string | null;
                    /** @default false */
                    isShared?: boolean;
                    composition: {
                        head: {
                            armorId: string;
                            /** @default [] */
                            decorations?: {
                                slotIndex: number;
                                decorationId: string;
                            }[];
                        } | null;
                        chest: {
                            armorId: string;
                            /** @default [] */
                            decorations?: {
                                slotIndex: number;
                                decorationId: string;
                            }[];
                        } | null;
                        arms: {
                            armorId: string;
                            /** @default [] */
                            decorations?: {
                                slotIndex: number;
                                decorationId: string;
                            }[];
                        } | null;
                        waist: {
                            armorId: string;
                            /** @default [] */
                            decorations?: {
                                slotIndex: number;
                                decorationId: string;
                            }[];
                        } | null;
                        legs: {
                            armorId: string;
                            /** @default [] */
                            decorations?: {
                                slotIndex: number;
                                decorationId: string;
                            }[];
                        } | null;
                        talisman: {
                            /** @enum {string} */
                            source: "custom" | "scraped";
                            talismanId: string;
                            /** @default [] */
                            decorations?: {
                                slotIndex: number;
                                decorationId: string;
                            }[];
                        } | null;
                        weapon: {
                            /** @default null */
                            weaponId?: string | null;
                            /** @default [] */
                            decorations?: {
                                slotIndex: number;
                                decorationId: string;
                            }[];
                            setBonusId: string | null;
                            groupBonusId: string | null;
                            customization?: {
                                element: string | null;
                                attackParts: number;
                                affinityParts: number;
                                elementInfusion: boolean;
                                reinforcements: {
                                    type: string;
                                    level: string;
                                }[];
                            } | null;
                        } | null;
                    };
                };
                "application/x-www-form-urlencoded": {
                    name: string;
                    description?: string | null;
                    /** @default false */
                    isShared?: boolean;
                    composition: {
                        head: {
                            armorId: string;
                            /** @default [] */
                            decorations?: {
                                slotIndex: number;
                                decorationId: string;
                            }[];
                        } | null;
                        chest: {
                            armorId: string;
                            /** @default [] */
                            decorations?: {
                                slotIndex: number;
                                decorationId: string;
                            }[];
                        } | null;
                        arms: {
                            armorId: string;
                            /** @default [] */
                            decorations?: {
                                slotIndex: number;
                                decorationId: string;
                            }[];
                        } | null;
                        waist: {
                            armorId: string;
                            /** @default [] */
                            decorations?: {
                                slotIndex: number;
                                decorationId: string;
                            }[];
                        } | null;
                        legs: {
                            armorId: string;
                            /** @default [] */
                            decorations?: {
                                slotIndex: number;
                                decorationId: string;
                            }[];
                        } | null;
                        talisman: {
                            /** @enum {string} */
                            source: "custom" | "scraped";
                            talismanId: string;
                            /** @default [] */
                            decorations?: {
                                slotIndex: number;
                                decorationId: string;
                            }[];
                        } | null;
                        weapon: {
                            /** @default null */
                            weaponId?: string | null;
                            /** @default [] */
                            decorations?: {
                                slotIndex: number;
                                decorationId: string;
                            }[];
                            setBonusId: string | null;
                            groupBonusId: string | null;
                            customization?: {
                                element: string | null;
                                attackParts: number;
                                affinityParts: number;
                                elementInfusion: boolean;
                                reinforcements: {
                                    type: string;
                                    level: string;
                                }[];
                            } | null;
                        } | null;
                    };
                };
                "multipart/form-data": {
                    name: string;
                    description?: string | null;
                    /** @default false */
                    isShared?: boolean;
                    composition: {
                        head: {
                            armorId: string;
                            /** @default [] */
                            decorations?: {
                                slotIndex: number;
                                decorationId: string;
                            }[];
                        } | null;
                        chest: {
                            armorId: string;
                            /** @default [] */
                            decorations?: {
                                slotIndex: number;
                                decorationId: string;
                            }[];
                        } | null;
                        arms: {
                            armorId: string;
                            /** @default [] */
                            decorations?: {
                                slotIndex: number;
                                decorationId: string;
                            }[];
                        } | null;
                        waist: {
                            armorId: string;
                            /** @default [] */
                            decorations?: {
                                slotIndex: number;
                                decorationId: string;
                            }[];
                        } | null;
                        legs: {
                            armorId: string;
                            /** @default [] */
                            decorations?: {
                                slotIndex: number;
                                decorationId: string;
                            }[];
                        } | null;
                        talisman: {
                            /** @enum {string} */
                            source: "custom" | "scraped";
                            talismanId: string;
                            /** @default [] */
                            decorations?: {
                                slotIndex: number;
                                decorationId: string;
                            }[];
                        } | null;
                        weapon: {
                            /** @default null */
                            weaponId?: string | null;
                            /** @default [] */
                            decorations?: {
                                slotIndex: number;
                                decorationId: string;
                            }[];
                            setBonusId: string | null;
                            groupBonusId: string | null;
                            customization?: {
                                element: string | null;
                                attackParts: number;
                                affinityParts: number;
                                elementInfusion: boolean;
                                reinforcements: {
                                    type: string;
                                    level: string;
                                }[];
                            } | null;
                        } | null;
                    };
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
                        id: string;
                        name: string;
                        description: string | null;
                        isShared: boolean;
                        sharedAt: string | null;
                        revision: number;
                        isStale: boolean;
                        createdAt: string;
                        updatedAt: string;
                        composition: {
                            /** @constant */
                            schemaVersion: 1;
                            positions: {
                                head: {
                                    armorId: string;
                                    name: string;
                                    /** @enum {string} */
                                    type: "head" | "chest" | "arms" | "waist" | "legs";
                                    rank: string;
                                    rarity: number;
                                    defense: number;
                                    resistances: {
                                        fire: number;
                                        water: number;
                                        thunder: number;
                                        ice: number;
                                        dragon: number;
                                    };
                                    slots: number[];
                                    skills: {
                                        skillId: string;
                                        name: string;
                                        level: number;
                                    }[];
                                    bonuses: {
                                        bonusId: string;
                                        name: string;
                                        /** @enum {string} */
                                        kind: "set" | "group";
                                    }[];
                                    decorations: {
                                        slotIndex: number;
                                        decorationId: string;
                                        name: string;
                                        slotSize: number;
                                        skills: {
                                            skillId: string;
                                            name: string;
                                            level: number;
                                        }[];
                                    }[];
                                } | null;
                                chest: {
                                    armorId: string;
                                    name: string;
                                    /** @enum {string} */
                                    type: "head" | "chest" | "arms" | "waist" | "legs";
                                    rank: string;
                                    rarity: number;
                                    defense: number;
                                    resistances: {
                                        fire: number;
                                        water: number;
                                        thunder: number;
                                        ice: number;
                                        dragon: number;
                                    };
                                    slots: number[];
                                    skills: {
                                        skillId: string;
                                        name: string;
                                        level: number;
                                    }[];
                                    bonuses: {
                                        bonusId: string;
                                        name: string;
                                        /** @enum {string} */
                                        kind: "set" | "group";
                                    }[];
                                    decorations: {
                                        slotIndex: number;
                                        decorationId: string;
                                        name: string;
                                        slotSize: number;
                                        skills: {
                                            skillId: string;
                                            name: string;
                                            level: number;
                                        }[];
                                    }[];
                                } | null;
                                arms: {
                                    armorId: string;
                                    name: string;
                                    /** @enum {string} */
                                    type: "head" | "chest" | "arms" | "waist" | "legs";
                                    rank: string;
                                    rarity: number;
                                    defense: number;
                                    resistances: {
                                        fire: number;
                                        water: number;
                                        thunder: number;
                                        ice: number;
                                        dragon: number;
                                    };
                                    slots: number[];
                                    skills: {
                                        skillId: string;
                                        name: string;
                                        level: number;
                                    }[];
                                    bonuses: {
                                        bonusId: string;
                                        name: string;
                                        /** @enum {string} */
                                        kind: "set" | "group";
                                    }[];
                                    decorations: {
                                        slotIndex: number;
                                        decorationId: string;
                                        name: string;
                                        slotSize: number;
                                        skills: {
                                            skillId: string;
                                            name: string;
                                            level: number;
                                        }[];
                                    }[];
                                } | null;
                                waist: {
                                    armorId: string;
                                    name: string;
                                    /** @enum {string} */
                                    type: "head" | "chest" | "arms" | "waist" | "legs";
                                    rank: string;
                                    rarity: number;
                                    defense: number;
                                    resistances: {
                                        fire: number;
                                        water: number;
                                        thunder: number;
                                        ice: number;
                                        dragon: number;
                                    };
                                    slots: number[];
                                    skills: {
                                        skillId: string;
                                        name: string;
                                        level: number;
                                    }[];
                                    bonuses: {
                                        bonusId: string;
                                        name: string;
                                        /** @enum {string} */
                                        kind: "set" | "group";
                                    }[];
                                    decorations: {
                                        slotIndex: number;
                                        decorationId: string;
                                        name: string;
                                        slotSize: number;
                                        skills: {
                                            skillId: string;
                                            name: string;
                                            level: number;
                                        }[];
                                    }[];
                                } | null;
                                legs: {
                                    armorId: string;
                                    name: string;
                                    /** @enum {string} */
                                    type: "head" | "chest" | "arms" | "waist" | "legs";
                                    rank: string;
                                    rarity: number;
                                    defense: number;
                                    resistances: {
                                        fire: number;
                                        water: number;
                                        thunder: number;
                                        ice: number;
                                        dragon: number;
                                    };
                                    slots: number[];
                                    skills: {
                                        skillId: string;
                                        name: string;
                                        level: number;
                                    }[];
                                    bonuses: {
                                        bonusId: string;
                                        name: string;
                                        /** @enum {string} */
                                        kind: "set" | "group";
                                    }[];
                                    decorations: {
                                        slotIndex: number;
                                        decorationId: string;
                                        name: string;
                                        slotSize: number;
                                        skills: {
                                            skillId: string;
                                            name: string;
                                            level: number;
                                        }[];
                                    }[];
                                } | null;
                                talisman: {
                                    /** @enum {string} */
                                    source: "custom" | "scraped";
                                    talismanId: string;
                                    name: string;
                                    slots: {
                                        /** @enum {string} */
                                        type: "weapon" | "armor";
                                        size: number;
                                    }[];
                                    skills: {
                                        skillId: string;
                                        name: string;
                                        level: number;
                                    }[];
                                    bonuses: {
                                        bonusId: string;
                                        name: string;
                                        /** @enum {string} */
                                        kind: "set" | "group";
                                    }[];
                                    decorations: {
                                        slotIndex: number;
                                        decorationId: string;
                                        name: string;
                                        slotSize: number;
                                        skills: {
                                            skillId: string;
                                            name: string;
                                            level: number;
                                        }[];
                                    }[];
                                } | null;
                                weapon: {
                                    weaponId?: string | null;
                                    name?: string;
                                    /** @enum {string} */
                                    kind?: "great-sword" | "long-sword" | "sword-shield" | "dual-blades" | "hammer" | "hunting-horn" | "lance" | "gunlance" | "switch-axe" | "charge-blade" | "insect-glaive" | "bow" | "light-bowgun" | "heavy-bowgun";
                                    rarity?: number;
                                    damage?: {
                                        raw: number;
                                        display: number;
                                    };
                                    affinity?: number;
                                    specials?: {
                                        /** @enum {string} */
                                        kind: "element" | "status";
                                        name: string;
                                        damage: {
                                            raw: number;
                                            display: number;
                                        };
                                        hidden: boolean;
                                    }[];
                                    sharpness?: {
                                        red: number;
                                        orange: number;
                                        yellow: number;
                                        green: number;
                                        blue: number;
                                        white: number;
                                        purple: number;
                                    } | null;
                                    slots?: number[];
                                    skills?: {
                                        skillId: string;
                                        name: string;
                                        level: number;
                                    }[];
                                    decorations?: {
                                        slotIndex: number;
                                        decorationId: string;
                                        name: string;
                                        slotSize: number;
                                        skills: {
                                            skillId: string;
                                            name: string;
                                            level: number;
                                        }[];
                                    }[];
                                    customization?: {
                                        /** @enum {string} */
                                        family: "artian" | "gogma";
                                        /** @enum {number} */
                                        tier: 6 | 7 | 8;
                                        /** @enum {string | null} */
                                        focus: "attack" | "affinity" | "element" | null;
                                        config: {
                                            element: "fire" | "water" | "thunder" | "ice" | "dragon" | "poison" | "paralysis" | "sleep" | "blast" | null;
                                            attackParts: number;
                                            affinityParts: number;
                                            elementInfusion: boolean;
                                            reinforcements: {
                                                /** @enum {string} */
                                                type: "attack" | "affinity" | "element" | "sharpness" | "ammo";
                                                /** @enum {string} */
                                                level: "I" | "II" | "III" | "EX";
                                            }[];
                                        };
                                        base: {
                                            damage: {
                                                raw: number;
                                                display: number;
                                            };
                                            affinity: number;
                                        };
                                        sharpnessBonus: number;
                                        ammoBonus: number;
                                        gameVersion: string;
                                    } | null;
                                    setBonus: {
                                        bonusId: string;
                                        name: string;
                                        /** @enum {string} */
                                        kind: "set" | "group";
                                    } | null;
                                    groupBonus: {
                                        bonusId: string;
                                        name: string;
                                        /** @enum {string} */
                                        kind: "set" | "group";
                                    } | null;
                                } | null;
                            };
                            skillDefinitions: {
                                [key: string]: number;
                            };
                            bonusDefinitions: {
                                [key: string]: {
                                    /** @enum {string} */
                                    kind: "set" | "group";
                                    thresholds: {
                                        piecesRequired: number;
                                        effectName: string;
                                        level: number;
                                    }[];
                                };
                            };
                        };
                    };
                };
            };
        };
    };
    "deleteApiMh-wildsBuildsById": {
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
    "patchApiMh-wildsBuildsById": {
        parameters: {
            query: {
                revision: number;
            };
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    name?: string;
                    description?: string | null;
                    isShared?: boolean;
                };
                "application/x-www-form-urlencoded": {
                    name?: string;
                    description?: string | null;
                    isShared?: boolean;
                };
                "multipart/form-data": {
                    name?: string;
                    description?: string | null;
                    isShared?: boolean;
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
                        id: string;
                        name: string;
                        description: string | null;
                        isShared: boolean;
                        sharedAt: string | null;
                        revision: number;
                        isStale: boolean;
                        createdAt: string;
                        updatedAt: string;
                        composition: {
                            /** @constant */
                            schemaVersion: 1;
                            positions: {
                                head: {
                                    armorId: string;
                                    name: string;
                                    /** @enum {string} */
                                    type: "head" | "chest" | "arms" | "waist" | "legs";
                                    rank: string;
                                    rarity: number;
                                    defense: number;
                                    resistances: {
                                        fire: number;
                                        water: number;
                                        thunder: number;
                                        ice: number;
                                        dragon: number;
                                    };
                                    slots: number[];
                                    skills: {
                                        skillId: string;
                                        name: string;
                                        level: number;
                                    }[];
                                    bonuses: {
                                        bonusId: string;
                                        name: string;
                                        /** @enum {string} */
                                        kind: "set" | "group";
                                    }[];
                                    decorations: {
                                        slotIndex: number;
                                        decorationId: string;
                                        name: string;
                                        slotSize: number;
                                        skills: {
                                            skillId: string;
                                            name: string;
                                            level: number;
                                        }[];
                                    }[];
                                } | null;
                                chest: {
                                    armorId: string;
                                    name: string;
                                    /** @enum {string} */
                                    type: "head" | "chest" | "arms" | "waist" | "legs";
                                    rank: string;
                                    rarity: number;
                                    defense: number;
                                    resistances: {
                                        fire: number;
                                        water: number;
                                        thunder: number;
                                        ice: number;
                                        dragon: number;
                                    };
                                    slots: number[];
                                    skills: {
                                        skillId: string;
                                        name: string;
                                        level: number;
                                    }[];
                                    bonuses: {
                                        bonusId: string;
                                        name: string;
                                        /** @enum {string} */
                                        kind: "set" | "group";
                                    }[];
                                    decorations: {
                                        slotIndex: number;
                                        decorationId: string;
                                        name: string;
                                        slotSize: number;
                                        skills: {
                                            skillId: string;
                                            name: string;
                                            level: number;
                                        }[];
                                    }[];
                                } | null;
                                arms: {
                                    armorId: string;
                                    name: string;
                                    /** @enum {string} */
                                    type: "head" | "chest" | "arms" | "waist" | "legs";
                                    rank: string;
                                    rarity: number;
                                    defense: number;
                                    resistances: {
                                        fire: number;
                                        water: number;
                                        thunder: number;
                                        ice: number;
                                        dragon: number;
                                    };
                                    slots: number[];
                                    skills: {
                                        skillId: string;
                                        name: string;
                                        level: number;
                                    }[];
                                    bonuses: {
                                        bonusId: string;
                                        name: string;
                                        /** @enum {string} */
                                        kind: "set" | "group";
                                    }[];
                                    decorations: {
                                        slotIndex: number;
                                        decorationId: string;
                                        name: string;
                                        slotSize: number;
                                        skills: {
                                            skillId: string;
                                            name: string;
                                            level: number;
                                        }[];
                                    }[];
                                } | null;
                                waist: {
                                    armorId: string;
                                    name: string;
                                    /** @enum {string} */
                                    type: "head" | "chest" | "arms" | "waist" | "legs";
                                    rank: string;
                                    rarity: number;
                                    defense: number;
                                    resistances: {
                                        fire: number;
                                        water: number;
                                        thunder: number;
                                        ice: number;
                                        dragon: number;
                                    };
                                    slots: number[];
                                    skills: {
                                        skillId: string;
                                        name: string;
                                        level: number;
                                    }[];
                                    bonuses: {
                                        bonusId: string;
                                        name: string;
                                        /** @enum {string} */
                                        kind: "set" | "group";
                                    }[];
                                    decorations: {
                                        slotIndex: number;
                                        decorationId: string;
                                        name: string;
                                        slotSize: number;
                                        skills: {
                                            skillId: string;
                                            name: string;
                                            level: number;
                                        }[];
                                    }[];
                                } | null;
                                legs: {
                                    armorId: string;
                                    name: string;
                                    /** @enum {string} */
                                    type: "head" | "chest" | "arms" | "waist" | "legs";
                                    rank: string;
                                    rarity: number;
                                    defense: number;
                                    resistances: {
                                        fire: number;
                                        water: number;
                                        thunder: number;
                                        ice: number;
                                        dragon: number;
                                    };
                                    slots: number[];
                                    skills: {
                                        skillId: string;
                                        name: string;
                                        level: number;
                                    }[];
                                    bonuses: {
                                        bonusId: string;
                                        name: string;
                                        /** @enum {string} */
                                        kind: "set" | "group";
                                    }[];
                                    decorations: {
                                        slotIndex: number;
                                        decorationId: string;
                                        name: string;
                                        slotSize: number;
                                        skills: {
                                            skillId: string;
                                            name: string;
                                            level: number;
                                        }[];
                                    }[];
                                } | null;
                                talisman: {
                                    /** @enum {string} */
                                    source: "custom" | "scraped";
                                    talismanId: string;
                                    name: string;
                                    slots: {
                                        /** @enum {string} */
                                        type: "weapon" | "armor";
                                        size: number;
                                    }[];
                                    skills: {
                                        skillId: string;
                                        name: string;
                                        level: number;
                                    }[];
                                    bonuses: {
                                        bonusId: string;
                                        name: string;
                                        /** @enum {string} */
                                        kind: "set" | "group";
                                    }[];
                                    decorations: {
                                        slotIndex: number;
                                        decorationId: string;
                                        name: string;
                                        slotSize: number;
                                        skills: {
                                            skillId: string;
                                            name: string;
                                            level: number;
                                        }[];
                                    }[];
                                } | null;
                                weapon: {
                                    weaponId?: string | null;
                                    name?: string;
                                    /** @enum {string} */
                                    kind?: "great-sword" | "long-sword" | "sword-shield" | "dual-blades" | "hammer" | "hunting-horn" | "lance" | "gunlance" | "switch-axe" | "charge-blade" | "insect-glaive" | "bow" | "light-bowgun" | "heavy-bowgun";
                                    rarity?: number;
                                    damage?: {
                                        raw: number;
                                        display: number;
                                    };
                                    affinity?: number;
                                    specials?: {
                                        /** @enum {string} */
                                        kind: "element" | "status";
                                        name: string;
                                        damage: {
                                            raw: number;
                                            display: number;
                                        };
                                        hidden: boolean;
                                    }[];
                                    sharpness?: {
                                        red: number;
                                        orange: number;
                                        yellow: number;
                                        green: number;
                                        blue: number;
                                        white: number;
                                        purple: number;
                                    } | null;
                                    slots?: number[];
                                    skills?: {
                                        skillId: string;
                                        name: string;
                                        level: number;
                                    }[];
                                    decorations?: {
                                        slotIndex: number;
                                        decorationId: string;
                                        name: string;
                                        slotSize: number;
                                        skills: {
                                            skillId: string;
                                            name: string;
                                            level: number;
                                        }[];
                                    }[];
                                    customization?: {
                                        /** @enum {string} */
                                        family: "artian" | "gogma";
                                        /** @enum {number} */
                                        tier: 6 | 7 | 8;
                                        /** @enum {string | null} */
                                        focus: "attack" | "affinity" | "element" | null;
                                        config: {
                                            element: "fire" | "water" | "thunder" | "ice" | "dragon" | "poison" | "paralysis" | "sleep" | "blast" | null;
                                            attackParts: number;
                                            affinityParts: number;
                                            elementInfusion: boolean;
                                            reinforcements: {
                                                /** @enum {string} */
                                                type: "attack" | "affinity" | "element" | "sharpness" | "ammo";
                                                /** @enum {string} */
                                                level: "I" | "II" | "III" | "EX";
                                            }[];
                                        };
                                        base: {
                                            damage: {
                                                raw: number;
                                                display: number;
                                            };
                                            affinity: number;
                                        };
                                        sharpnessBonus: number;
                                        ammoBonus: number;
                                        gameVersion: string;
                                    } | null;
                                    setBonus: {
                                        bonusId: string;
                                        name: string;
                                        /** @enum {string} */
                                        kind: "set" | "group";
                                    } | null;
                                    groupBonus: {
                                        bonusId: string;
                                        name: string;
                                        /** @enum {string} */
                                        kind: "set" | "group";
                                    } | null;
                                } | null;
                            };
                            skillDefinitions: {
                                [key: string]: number;
                            };
                            bonusDefinitions: {
                                [key: string]: {
                                    /** @enum {string} */
                                    kind: "set" | "group";
                                    thresholds: {
                                        piecesRequired: number;
                                        effectName: string;
                                        level: number;
                                    }[];
                                };
                            };
                        };
                    };
                };
            };
        };
    };
    "getApiMh-wildsBuilds": {
        parameters: {
            query?: never;
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
                        description: string | null;
                        isShared: boolean;
                        sharedAt: string | null;
                        revision: number;
                        isStale: boolean;
                        createdAt: string;
                        updatedAt: string;
                        owner: {
                            displayName: string | null;
                            avatarUrl: string | null;
                        } | null;
                    }[];
                };
            };
        };
    };
    "postApiMh-wildsBuilds": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    name: string;
                    description?: string | null;
                    /** @default false */
                    isShared?: boolean;
                    composition: {
                        head: {
                            armorId: string;
                            /** @default [] */
                            decorations?: {
                                slotIndex: number;
                                decorationId: string;
                            }[];
                        } | null;
                        chest: {
                            armorId: string;
                            /** @default [] */
                            decorations?: {
                                slotIndex: number;
                                decorationId: string;
                            }[];
                        } | null;
                        arms: {
                            armorId: string;
                            /** @default [] */
                            decorations?: {
                                slotIndex: number;
                                decorationId: string;
                            }[];
                        } | null;
                        waist: {
                            armorId: string;
                            /** @default [] */
                            decorations?: {
                                slotIndex: number;
                                decorationId: string;
                            }[];
                        } | null;
                        legs: {
                            armorId: string;
                            /** @default [] */
                            decorations?: {
                                slotIndex: number;
                                decorationId: string;
                            }[];
                        } | null;
                        talisman: {
                            /** @enum {string} */
                            source: "custom" | "scraped";
                            talismanId: string;
                            /** @default [] */
                            decorations?: {
                                slotIndex: number;
                                decorationId: string;
                            }[];
                        } | null;
                        weapon: {
                            /** @default null */
                            weaponId?: string | null;
                            /** @default [] */
                            decorations?: {
                                slotIndex: number;
                                decorationId: string;
                            }[];
                            setBonusId: string | null;
                            groupBonusId: string | null;
                            customization?: {
                                element: string | null;
                                attackParts: number;
                                affinityParts: number;
                                elementInfusion: boolean;
                                reinforcements: {
                                    type: string;
                                    level: string;
                                }[];
                            } | null;
                        } | null;
                    };
                };
                "application/x-www-form-urlencoded": {
                    name: string;
                    description?: string | null;
                    /** @default false */
                    isShared?: boolean;
                    composition: {
                        head: {
                            armorId: string;
                            /** @default [] */
                            decorations?: {
                                slotIndex: number;
                                decorationId: string;
                            }[];
                        } | null;
                        chest: {
                            armorId: string;
                            /** @default [] */
                            decorations?: {
                                slotIndex: number;
                                decorationId: string;
                            }[];
                        } | null;
                        arms: {
                            armorId: string;
                            /** @default [] */
                            decorations?: {
                                slotIndex: number;
                                decorationId: string;
                            }[];
                        } | null;
                        waist: {
                            armorId: string;
                            /** @default [] */
                            decorations?: {
                                slotIndex: number;
                                decorationId: string;
                            }[];
                        } | null;
                        legs: {
                            armorId: string;
                            /** @default [] */
                            decorations?: {
                                slotIndex: number;
                                decorationId: string;
                            }[];
                        } | null;
                        talisman: {
                            /** @enum {string} */
                            source: "custom" | "scraped";
                            talismanId: string;
                            /** @default [] */
                            decorations?: {
                                slotIndex: number;
                                decorationId: string;
                            }[];
                        } | null;
                        weapon: {
                            /** @default null */
                            weaponId?: string | null;
                            /** @default [] */
                            decorations?: {
                                slotIndex: number;
                                decorationId: string;
                            }[];
                            setBonusId: string | null;
                            groupBonusId: string | null;
                            customization?: {
                                element: string | null;
                                attackParts: number;
                                affinityParts: number;
                                elementInfusion: boolean;
                                reinforcements: {
                                    type: string;
                                    level: string;
                                }[];
                            } | null;
                        } | null;
                    };
                };
                "multipart/form-data": {
                    name: string;
                    description?: string | null;
                    /** @default false */
                    isShared?: boolean;
                    composition: {
                        head: {
                            armorId: string;
                            /** @default [] */
                            decorations?: {
                                slotIndex: number;
                                decorationId: string;
                            }[];
                        } | null;
                        chest: {
                            armorId: string;
                            /** @default [] */
                            decorations?: {
                                slotIndex: number;
                                decorationId: string;
                            }[];
                        } | null;
                        arms: {
                            armorId: string;
                            /** @default [] */
                            decorations?: {
                                slotIndex: number;
                                decorationId: string;
                            }[];
                        } | null;
                        waist: {
                            armorId: string;
                            /** @default [] */
                            decorations?: {
                                slotIndex: number;
                                decorationId: string;
                            }[];
                        } | null;
                        legs: {
                            armorId: string;
                            /** @default [] */
                            decorations?: {
                                slotIndex: number;
                                decorationId: string;
                            }[];
                        } | null;
                        talisman: {
                            /** @enum {string} */
                            source: "custom" | "scraped";
                            talismanId: string;
                            /** @default [] */
                            decorations?: {
                                slotIndex: number;
                                decorationId: string;
                            }[];
                        } | null;
                        weapon: {
                            /** @default null */
                            weaponId?: string | null;
                            /** @default [] */
                            decorations?: {
                                slotIndex: number;
                                decorationId: string;
                            }[];
                            setBonusId: string | null;
                            groupBonusId: string | null;
                            customization?: {
                                element: string | null;
                                attackParts: number;
                                affinityParts: number;
                                elementInfusion: boolean;
                                reinforcements: {
                                    type: string;
                                    level: string;
                                }[];
                            } | null;
                        } | null;
                    };
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
                        id: string;
                        name: string;
                        description: string | null;
                        isShared: boolean;
                        sharedAt: string | null;
                        revision: number;
                        isStale: boolean;
                        createdAt: string;
                        updatedAt: string;
                        composition: {
                            /** @constant */
                            schemaVersion: 1;
                            positions: {
                                head: {
                                    armorId: string;
                                    name: string;
                                    /** @enum {string} */
                                    type: "head" | "chest" | "arms" | "waist" | "legs";
                                    rank: string;
                                    rarity: number;
                                    defense: number;
                                    resistances: {
                                        fire: number;
                                        water: number;
                                        thunder: number;
                                        ice: number;
                                        dragon: number;
                                    };
                                    slots: number[];
                                    skills: {
                                        skillId: string;
                                        name: string;
                                        level: number;
                                    }[];
                                    bonuses: {
                                        bonusId: string;
                                        name: string;
                                        /** @enum {string} */
                                        kind: "set" | "group";
                                    }[];
                                    decorations: {
                                        slotIndex: number;
                                        decorationId: string;
                                        name: string;
                                        slotSize: number;
                                        skills: {
                                            skillId: string;
                                            name: string;
                                            level: number;
                                        }[];
                                    }[];
                                } | null;
                                chest: {
                                    armorId: string;
                                    name: string;
                                    /** @enum {string} */
                                    type: "head" | "chest" | "arms" | "waist" | "legs";
                                    rank: string;
                                    rarity: number;
                                    defense: number;
                                    resistances: {
                                        fire: number;
                                        water: number;
                                        thunder: number;
                                        ice: number;
                                        dragon: number;
                                    };
                                    slots: number[];
                                    skills: {
                                        skillId: string;
                                        name: string;
                                        level: number;
                                    }[];
                                    bonuses: {
                                        bonusId: string;
                                        name: string;
                                        /** @enum {string} */
                                        kind: "set" | "group";
                                    }[];
                                    decorations: {
                                        slotIndex: number;
                                        decorationId: string;
                                        name: string;
                                        slotSize: number;
                                        skills: {
                                            skillId: string;
                                            name: string;
                                            level: number;
                                        }[];
                                    }[];
                                } | null;
                                arms: {
                                    armorId: string;
                                    name: string;
                                    /** @enum {string} */
                                    type: "head" | "chest" | "arms" | "waist" | "legs";
                                    rank: string;
                                    rarity: number;
                                    defense: number;
                                    resistances: {
                                        fire: number;
                                        water: number;
                                        thunder: number;
                                        ice: number;
                                        dragon: number;
                                    };
                                    slots: number[];
                                    skills: {
                                        skillId: string;
                                        name: string;
                                        level: number;
                                    }[];
                                    bonuses: {
                                        bonusId: string;
                                        name: string;
                                        /** @enum {string} */
                                        kind: "set" | "group";
                                    }[];
                                    decorations: {
                                        slotIndex: number;
                                        decorationId: string;
                                        name: string;
                                        slotSize: number;
                                        skills: {
                                            skillId: string;
                                            name: string;
                                            level: number;
                                        }[];
                                    }[];
                                } | null;
                                waist: {
                                    armorId: string;
                                    name: string;
                                    /** @enum {string} */
                                    type: "head" | "chest" | "arms" | "waist" | "legs";
                                    rank: string;
                                    rarity: number;
                                    defense: number;
                                    resistances: {
                                        fire: number;
                                        water: number;
                                        thunder: number;
                                        ice: number;
                                        dragon: number;
                                    };
                                    slots: number[];
                                    skills: {
                                        skillId: string;
                                        name: string;
                                        level: number;
                                    }[];
                                    bonuses: {
                                        bonusId: string;
                                        name: string;
                                        /** @enum {string} */
                                        kind: "set" | "group";
                                    }[];
                                    decorations: {
                                        slotIndex: number;
                                        decorationId: string;
                                        name: string;
                                        slotSize: number;
                                        skills: {
                                            skillId: string;
                                            name: string;
                                            level: number;
                                        }[];
                                    }[];
                                } | null;
                                legs: {
                                    armorId: string;
                                    name: string;
                                    /** @enum {string} */
                                    type: "head" | "chest" | "arms" | "waist" | "legs";
                                    rank: string;
                                    rarity: number;
                                    defense: number;
                                    resistances: {
                                        fire: number;
                                        water: number;
                                        thunder: number;
                                        ice: number;
                                        dragon: number;
                                    };
                                    slots: number[];
                                    skills: {
                                        skillId: string;
                                        name: string;
                                        level: number;
                                    }[];
                                    bonuses: {
                                        bonusId: string;
                                        name: string;
                                        /** @enum {string} */
                                        kind: "set" | "group";
                                    }[];
                                    decorations: {
                                        slotIndex: number;
                                        decorationId: string;
                                        name: string;
                                        slotSize: number;
                                        skills: {
                                            skillId: string;
                                            name: string;
                                            level: number;
                                        }[];
                                    }[];
                                } | null;
                                talisman: {
                                    /** @enum {string} */
                                    source: "custom" | "scraped";
                                    talismanId: string;
                                    name: string;
                                    slots: {
                                        /** @enum {string} */
                                        type: "weapon" | "armor";
                                        size: number;
                                    }[];
                                    skills: {
                                        skillId: string;
                                        name: string;
                                        level: number;
                                    }[];
                                    bonuses: {
                                        bonusId: string;
                                        name: string;
                                        /** @enum {string} */
                                        kind: "set" | "group";
                                    }[];
                                    decorations: {
                                        slotIndex: number;
                                        decorationId: string;
                                        name: string;
                                        slotSize: number;
                                        skills: {
                                            skillId: string;
                                            name: string;
                                            level: number;
                                        }[];
                                    }[];
                                } | null;
                                weapon: {
                                    weaponId?: string | null;
                                    name?: string;
                                    /** @enum {string} */
                                    kind?: "great-sword" | "long-sword" | "sword-shield" | "dual-blades" | "hammer" | "hunting-horn" | "lance" | "gunlance" | "switch-axe" | "charge-blade" | "insect-glaive" | "bow" | "light-bowgun" | "heavy-bowgun";
                                    rarity?: number;
                                    damage?: {
                                        raw: number;
                                        display: number;
                                    };
                                    affinity?: number;
                                    specials?: {
                                        /** @enum {string} */
                                        kind: "element" | "status";
                                        name: string;
                                        damage: {
                                            raw: number;
                                            display: number;
                                        };
                                        hidden: boolean;
                                    }[];
                                    sharpness?: {
                                        red: number;
                                        orange: number;
                                        yellow: number;
                                        green: number;
                                        blue: number;
                                        white: number;
                                        purple: number;
                                    } | null;
                                    slots?: number[];
                                    skills?: {
                                        skillId: string;
                                        name: string;
                                        level: number;
                                    }[];
                                    decorations?: {
                                        slotIndex: number;
                                        decorationId: string;
                                        name: string;
                                        slotSize: number;
                                        skills: {
                                            skillId: string;
                                            name: string;
                                            level: number;
                                        }[];
                                    }[];
                                    customization?: {
                                        /** @enum {string} */
                                        family: "artian" | "gogma";
                                        /** @enum {number} */
                                        tier: 6 | 7 | 8;
                                        /** @enum {string | null} */
                                        focus: "attack" | "affinity" | "element" | null;
                                        config: {
                                            element: "fire" | "water" | "thunder" | "ice" | "dragon" | "poison" | "paralysis" | "sleep" | "blast" | null;
                                            attackParts: number;
                                            affinityParts: number;
                                            elementInfusion: boolean;
                                            reinforcements: {
                                                /** @enum {string} */
                                                type: "attack" | "affinity" | "element" | "sharpness" | "ammo";
                                                /** @enum {string} */
                                                level: "I" | "II" | "III" | "EX";
                                            }[];
                                        };
                                        base: {
                                            damage: {
                                                raw: number;
                                                display: number;
                                            };
                                            affinity: number;
                                        };
                                        sharpnessBonus: number;
                                        ammoBonus: number;
                                        gameVersion: string;
                                    } | null;
                                    setBonus: {
                                        bonusId: string;
                                        name: string;
                                        /** @enum {string} */
                                        kind: "set" | "group";
                                    } | null;
                                    groupBonus: {
                                        bonusId: string;
                                        name: string;
                                        /** @enum {string} */
                                        kind: "set" | "group";
                                    } | null;
                                } | null;
                            };
                            skillDefinitions: {
                                [key: string]: number;
                            };
                            bonusDefinitions: {
                                [key: string]: {
                                    /** @enum {string} */
                                    kind: "set" | "group";
                                    thresholds: {
                                        piecesRequired: number;
                                        effectName: string;
                                        level: number;
                                    }[];
                                };
                            };
                        };
                    };
                };
            };
        };
    };
    "postApiMh-wildsBuildsImport": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    result: {
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
                    };
                    weapon: {
                        setBonus: string | null;
                        groupBonus: string | null;
                    };
                    name: string;
                    description?: string | null;
                    /** @default false */
                    isShared?: boolean;
                };
                "application/x-www-form-urlencoded": {
                    result: {
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
                    };
                    weapon: {
                        setBonus: string | null;
                        groupBonus: string | null;
                    };
                    name: string;
                    description?: string | null;
                    /** @default false */
                    isShared?: boolean;
                };
                "multipart/form-data": {
                    result: {
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
                    };
                    weapon: {
                        setBonus: string | null;
                        groupBonus: string | null;
                    };
                    name: string;
                    description?: string | null;
                    /** @default false */
                    isShared?: boolean;
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
                        id: string;
                        name: string;
                        description: string | null;
                        isShared: boolean;
                        sharedAt: string | null;
                        revision: number;
                        isStale: boolean;
                        createdAt: string;
                        updatedAt: string;
                        composition: {
                            /** @constant */
                            schemaVersion: 1;
                            positions: {
                                head: {
                                    armorId: string;
                                    name: string;
                                    /** @enum {string} */
                                    type: "head" | "chest" | "arms" | "waist" | "legs";
                                    rank: string;
                                    rarity: number;
                                    defense: number;
                                    resistances: {
                                        fire: number;
                                        water: number;
                                        thunder: number;
                                        ice: number;
                                        dragon: number;
                                    };
                                    slots: number[];
                                    skills: {
                                        skillId: string;
                                        name: string;
                                        level: number;
                                    }[];
                                    bonuses: {
                                        bonusId: string;
                                        name: string;
                                        /** @enum {string} */
                                        kind: "set" | "group";
                                    }[];
                                    decorations: {
                                        slotIndex: number;
                                        decorationId: string;
                                        name: string;
                                        slotSize: number;
                                        skills: {
                                            skillId: string;
                                            name: string;
                                            level: number;
                                        }[];
                                    }[];
                                } | null;
                                chest: {
                                    armorId: string;
                                    name: string;
                                    /** @enum {string} */
                                    type: "head" | "chest" | "arms" | "waist" | "legs";
                                    rank: string;
                                    rarity: number;
                                    defense: number;
                                    resistances: {
                                        fire: number;
                                        water: number;
                                        thunder: number;
                                        ice: number;
                                        dragon: number;
                                    };
                                    slots: number[];
                                    skills: {
                                        skillId: string;
                                        name: string;
                                        level: number;
                                    }[];
                                    bonuses: {
                                        bonusId: string;
                                        name: string;
                                        /** @enum {string} */
                                        kind: "set" | "group";
                                    }[];
                                    decorations: {
                                        slotIndex: number;
                                        decorationId: string;
                                        name: string;
                                        slotSize: number;
                                        skills: {
                                            skillId: string;
                                            name: string;
                                            level: number;
                                        }[];
                                    }[];
                                } | null;
                                arms: {
                                    armorId: string;
                                    name: string;
                                    /** @enum {string} */
                                    type: "head" | "chest" | "arms" | "waist" | "legs";
                                    rank: string;
                                    rarity: number;
                                    defense: number;
                                    resistances: {
                                        fire: number;
                                        water: number;
                                        thunder: number;
                                        ice: number;
                                        dragon: number;
                                    };
                                    slots: number[];
                                    skills: {
                                        skillId: string;
                                        name: string;
                                        level: number;
                                    }[];
                                    bonuses: {
                                        bonusId: string;
                                        name: string;
                                        /** @enum {string} */
                                        kind: "set" | "group";
                                    }[];
                                    decorations: {
                                        slotIndex: number;
                                        decorationId: string;
                                        name: string;
                                        slotSize: number;
                                        skills: {
                                            skillId: string;
                                            name: string;
                                            level: number;
                                        }[];
                                    }[];
                                } | null;
                                waist: {
                                    armorId: string;
                                    name: string;
                                    /** @enum {string} */
                                    type: "head" | "chest" | "arms" | "waist" | "legs";
                                    rank: string;
                                    rarity: number;
                                    defense: number;
                                    resistances: {
                                        fire: number;
                                        water: number;
                                        thunder: number;
                                        ice: number;
                                        dragon: number;
                                    };
                                    slots: number[];
                                    skills: {
                                        skillId: string;
                                        name: string;
                                        level: number;
                                    }[];
                                    bonuses: {
                                        bonusId: string;
                                        name: string;
                                        /** @enum {string} */
                                        kind: "set" | "group";
                                    }[];
                                    decorations: {
                                        slotIndex: number;
                                        decorationId: string;
                                        name: string;
                                        slotSize: number;
                                        skills: {
                                            skillId: string;
                                            name: string;
                                            level: number;
                                        }[];
                                    }[];
                                } | null;
                                legs: {
                                    armorId: string;
                                    name: string;
                                    /** @enum {string} */
                                    type: "head" | "chest" | "arms" | "waist" | "legs";
                                    rank: string;
                                    rarity: number;
                                    defense: number;
                                    resistances: {
                                        fire: number;
                                        water: number;
                                        thunder: number;
                                        ice: number;
                                        dragon: number;
                                    };
                                    slots: number[];
                                    skills: {
                                        skillId: string;
                                        name: string;
                                        level: number;
                                    }[];
                                    bonuses: {
                                        bonusId: string;
                                        name: string;
                                        /** @enum {string} */
                                        kind: "set" | "group";
                                    }[];
                                    decorations: {
                                        slotIndex: number;
                                        decorationId: string;
                                        name: string;
                                        slotSize: number;
                                        skills: {
                                            skillId: string;
                                            name: string;
                                            level: number;
                                        }[];
                                    }[];
                                } | null;
                                talisman: {
                                    /** @enum {string} */
                                    source: "custom" | "scraped";
                                    talismanId: string;
                                    name: string;
                                    slots: {
                                        /** @enum {string} */
                                        type: "weapon" | "armor";
                                        size: number;
                                    }[];
                                    skills: {
                                        skillId: string;
                                        name: string;
                                        level: number;
                                    }[];
                                    bonuses: {
                                        bonusId: string;
                                        name: string;
                                        /** @enum {string} */
                                        kind: "set" | "group";
                                    }[];
                                    decorations: {
                                        slotIndex: number;
                                        decorationId: string;
                                        name: string;
                                        slotSize: number;
                                        skills: {
                                            skillId: string;
                                            name: string;
                                            level: number;
                                        }[];
                                    }[];
                                } | null;
                                weapon: {
                                    weaponId?: string | null;
                                    name?: string;
                                    /** @enum {string} */
                                    kind?: "great-sword" | "long-sword" | "sword-shield" | "dual-blades" | "hammer" | "hunting-horn" | "lance" | "gunlance" | "switch-axe" | "charge-blade" | "insect-glaive" | "bow" | "light-bowgun" | "heavy-bowgun";
                                    rarity?: number;
                                    damage?: {
                                        raw: number;
                                        display: number;
                                    };
                                    affinity?: number;
                                    specials?: {
                                        /** @enum {string} */
                                        kind: "element" | "status";
                                        name: string;
                                        damage: {
                                            raw: number;
                                            display: number;
                                        };
                                        hidden: boolean;
                                    }[];
                                    sharpness?: {
                                        red: number;
                                        orange: number;
                                        yellow: number;
                                        green: number;
                                        blue: number;
                                        white: number;
                                        purple: number;
                                    } | null;
                                    slots?: number[];
                                    skills?: {
                                        skillId: string;
                                        name: string;
                                        level: number;
                                    }[];
                                    decorations?: {
                                        slotIndex: number;
                                        decorationId: string;
                                        name: string;
                                        slotSize: number;
                                        skills: {
                                            skillId: string;
                                            name: string;
                                            level: number;
                                        }[];
                                    }[];
                                    customization?: {
                                        /** @enum {string} */
                                        family: "artian" | "gogma";
                                        /** @enum {number} */
                                        tier: 6 | 7 | 8;
                                        /** @enum {string | null} */
                                        focus: "attack" | "affinity" | "element" | null;
                                        config: {
                                            element: "fire" | "water" | "thunder" | "ice" | "dragon" | "poison" | "paralysis" | "sleep" | "blast" | null;
                                            attackParts: number;
                                            affinityParts: number;
                                            elementInfusion: boolean;
                                            reinforcements: {
                                                /** @enum {string} */
                                                type: "attack" | "affinity" | "element" | "sharpness" | "ammo";
                                                /** @enum {string} */
                                                level: "I" | "II" | "III" | "EX";
                                            }[];
                                        };
                                        base: {
                                            damage: {
                                                raw: number;
                                                display: number;
                                            };
                                            affinity: number;
                                        };
                                        sharpnessBonus: number;
                                        ammoBonus: number;
                                        gameVersion: string;
                                    } | null;
                                    setBonus: {
                                        bonusId: string;
                                        name: string;
                                        /** @enum {string} */
                                        kind: "set" | "group";
                                    } | null;
                                    groupBonus: {
                                        bonusId: string;
                                        name: string;
                                        /** @enum {string} */
                                        kind: "set" | "group";
                                    } | null;
                                } | null;
                            };
                            skillDefinitions: {
                                [key: string]: number;
                            };
                            bonusDefinitions: {
                                [key: string]: {
                                    /** @enum {string} */
                                    kind: "set" | "group";
                                    thresholds: {
                                        piecesRequired: number;
                                        effectName: string;
                                        level: number;
                                    }[];
                                };
                            };
                        };
                    };
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
