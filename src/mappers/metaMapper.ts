/* eslint-disable @typescript-eslint/no-explicit-any */

export class MetaMapper {
  /**
   * Calculates how many text variables are expected by a template, and whether it requires media.
   */
  static getTemplateRequirements(templateComponents: any[]): { expectedVariables: number, requiresMedia: boolean, mediaType?: string } {
    let expectedVariables = 0;
    let requiresMedia = false;
    let mediaType: string | undefined;
    
    for (const comp of templateComponents) {
      if (comp.type === 'HEADER' && (comp.format === 'IMAGE' || comp.format === 'DOCUMENT' || comp.format === 'VIDEO')) {
        requiresMedia = true;
        mediaType = comp.format.toLowerCase();
      }

      if (comp.text) {
        const matches = comp.text.match(/\{\{([^}]+)\}\}/g);
        if (matches) {
          // A given string might have {{name}} and {{order_id}} (2 variables)
          // Since named variables don't use maxIndex, we count unique instances.
          const uniqueVars = new Set(matches);
          expectedVariables += uniqueVars.size;
        }
      }
    }
    return { expectedVariables, requiresMedia, ...(mediaType ? { mediaType } : {}) };
  }

  /**
   * Maps a flat array of variables into Meta's component payload format.
   * Standard mapping order: HEADER -> BODY -> BUTTONS
   */
  static buildMetaTemplatePayload(
    templateName: string, 
    language: string, 
    variables: string[], 
    templateDefinition: any,
    mediaId?: string
  ): any {
    
    const metaComponents: any[] = [];
    let varIndex = 0;
    
    const componentOrder = ['HEADER', 'BODY', 'BUTTONS'];
    
    for (const compType of componentOrder) {
      const defComp = templateDefinition.components.find((c: any) => c.type === compType);
      
      if (compType === 'HEADER' && mediaId && (defComp?.format === 'DOCUMENT' || defComp?.format === 'IMAGE' || defComp?.format === 'VIDEO')) {
        const mediaType = defComp.format.toLowerCase();
        metaComponents.push({
          type: 'header',
          parameters: [
            {
              type: mediaType,
              [mediaType]: { id: mediaId }
            }
          ]
        });
      } else if (defComp && defComp.text) {
        let paramCount = 0;
        const matches = defComp.text.match(/\{\{([^}]+)\}\}/g);
        if (matches) {
          const uniqueVars = new Set(matches);
          paramCount = uniqueVars.size;
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
