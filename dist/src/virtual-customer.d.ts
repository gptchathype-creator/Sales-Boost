export declare const INITIAL_CHECKLIST: {
    greeted_and_introduced: "unknown";
    asked_about_specific_car: "unknown";
    presented_car_benefits: "unknown";
    invited_to_visit_today: "unknown";
    mentioned_underground_mall_inspection: "unknown";
    mentioned_wide_assortment: "unknown";
    offered_trade_in_buyout: "unknown";
    explained_financing_8_banks: "unknown";
    agreed_exact_visit_datetime: "unknown";
    agreed_next_contact_datetime: "unknown";
    discussed_address_and_how_to_get: "unknown";
};
export type ChecklistState = typeof INITIAL_CHECKLIST;
export interface VirtualCustomerState {
    stage: string;
    checklist: ChecklistState;
    notes: string;
}
export interface VirtualCustomerInput {
    car: Record<string, unknown> | string;
    dealership: string;
    state: VirtualCustomerState;
    manager_last_message: string | null;
    conversation_history?: Array<{
        role: 'client' | 'manager';
        text: string;
    }>;
    client_turn_count?: number;
}
export interface VirtualCustomerOutput {
    client_message: string;
    end_conversation: boolean;
    reason?: string;
    update_state: {
        stage: string;
        checklist: ChecklistState;
        notes: string;
    };
}
export declare function getVirtualCustomerMessage(input: VirtualCustomerInput): Promise<VirtualCustomerOutput>;
//# sourceMappingURL=virtual-customer.d.ts.map