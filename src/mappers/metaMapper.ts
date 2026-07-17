/* eslint-disable @typescript-eslint/no-explicit-any */

export class MetaMapper {
  /**
   * Calculates how many variables are expected by a template.
   */
  static calculateExpectedVariableCount(templateComponents: any[]): number {
    let count = 0;
    
    for (const comp of templateComponents) {
      if (comp.text) {
        // Find max number in {{n}} because they could be unordered or duplicated 
        // Actually, Meta requires them to be sequential 1, 2, 3...
        // Finding the highest number or just counting unique occurrences of {{n}}.
        // Usually, the number of parameters is exactly the highest index.
        const matches = comp.text.match(/\{\{(\d+)\}\}/g);
        if (matches) {
          // We can just use the length if we assume they are sequential without gaps/dupes
          // But safer to find the max index if needed. For now, length is standard.
          // Wait, Meta says {{1}}, {{2}} so max index is the count for that component.
          let maxIndex = 0;
          for (const match of matches) {
            const num = parseInt(match.replace(/\{|\}/g, ''), 10);
            if (num > maxIndex) maxIndex = num;
          }
          count += maxIndex;
        }
      }
      
      // Some buttons can have variables, but we'll focus on text parameters for MVP
    }
    return count;
  }

  /**
   * Maps a flat array of variables into Meta's component payload format.
   * Standard mapping order: HEADER -> BODY -> BUTTONS
   */
  static buildMetaTemplatePayload(
    templateName: string, 
    language: string, 
    variables: string[], 
    templateDefinition: any
  ): any {
    
    const metaComponents: any[] = [];
    let varIndex = 0;
    
    const componentOrder = ['HEADER', 'BODY', 'BUTTONS'];
    
    for (const compType of componentOrder) {
      const defComp = templateDefinition.components.find((c: any) => c.type === compType);
      
      if (defComp && defComp.text) {
        let paramCount = 0;
        const matches = defComp.text.match(/\{\{(\d+)\}\}/g);
        if (matches) {
          for (const match of matches) {
            const num = parseInt(match.replace(/\{|\}/g, ''), 10);
            if (num > paramCount) paramCount = num;
          }
        }
        
        if (paramCount > 0) {
          const params = [];
          for (let i = 0; i < paramCount; i++) {
            if (varIndex < variables.length) {
              params.push({
                type: 'text',
                text: variables[varIndex]
              });
              varIndex++;
            }
          }
          
          if (params.length > 0) {
            metaComponents.push({
              type: compType.toLowerCase(),
              parameters: params
            });
          }
        }
      }
    }

    return {
      name: templateName,
      language: { code: language },
      components: metaComponents
    };
  }
}
